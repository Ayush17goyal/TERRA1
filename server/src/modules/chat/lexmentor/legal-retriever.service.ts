/**
 * Stage 4 — Hybrid Retrieval
 *
 * Executes parallel searches across all legal corpus collections using:
 *   a) Dense vector search   — BGE-M3 / OpenAI embeddings via Qdrant
 *   b) HyDE vector search    — additional search using the hypothetical document vector
 *   c) Sub-query expansion   — each sub-query gets its own search pass
 *
 * Results from all passes are merged and deduplicated using Reciprocal Rank
 * Fusion (RRF), which is provably better than score averaging when combining
 * results from different retrieval strategies.
 *
 * Collection selection is guided by intent: Constitutional Law queries
 * are sent to the constitution collection first; Case Law queries are
 * sent to the judgments collections first. Every collection is searched
 * but the limit per collection varies by relevance.
 */

import { Injectable, Logger } from '@nestjs/common';
import { BgeM3Provider } from '../../retrieval/bge-m3.provider';
import { QdrantService } from '../../retrieval/qdrant.service';
import { LegalRetrievalService, LegalProvisionContext } from '../../retrieval/legal-retrieval.service';
import { AuthorityCollection, ExpandedQueries, LegalIntent, RetrievedAuthority } from './pipeline.types';

interface CollectionConfig {
  name: string;
  label: AuthorityCollection;
  authorityStrength: number;
  /** Relevance multiplier for a given intent — higher = searched more aggressively */
  intentAffinity: Partial<Record<LegalIntent, number>>;
}

const COLLECTIONS: CollectionConfig[] = [
  {
    name: 'constitution',
    label: 'Constitution',
    authorityStrength: 1.0,
    intentAffinity: { 'Constitutional Law': 1.5, 'Research': 1.2, 'Moot Court': 1.2 },
  },
  {
    name: 'bare_acts',
    label: 'Bare Acts',
    authorityStrength: 0.96,
    intentAffinity: { 'Bare Act': 1.5, 'Contract': 1.2, 'Concept': 1.1 },
  },
  {
    name: 'acts',
    label: 'Bare Acts',
    authorityStrength: 0.93,
    intentAffinity: { 'Bare Act': 1.4, 'Contract': 1.1 },
  },
  {
    name: 'supreme_court_cases',
    label: 'Supreme Court Judgments',
    authorityStrength: 0.98,
    intentAffinity: { 'Case Law': 1.5, 'Constitutional Law': 1.3, 'Research': 1.3, 'Moot Court': 1.4 },
  },
  {
    name: 'judgments',
    label: 'Supreme Court Judgments',
    authorityStrength: 0.90,
    intentAffinity: { 'Case Law': 1.4, 'Constitutional Law': 1.2, 'Moot Court': 1.3 },
  },
  {
    name: 'high_court_cases',
    label: 'High Court Judgments',
    authorityStrength: 0.82,
    intentAffinity: { 'Case Law': 1.2, 'Research': 1.0 },
  },
  {
    name: 'law_commission_reports',
    label: 'Law Commission Reports',
    authorityStrength: 0.78,
    intentAffinity: { 'Research': 1.4, 'Bare Act': 1.1, 'Concept': 1.1 },
  },
  {
    name: 'research_papers',
    label: 'Research Papers',
    authorityStrength: 0.62,
    intentAffinity: { 'Research': 1.3, 'Moot Court': 1.1 },
  },
  {
    name: 'user_documents',
    label: 'User Uploaded Documents',
    authorityStrength: 1.0,
    intentAffinity: { General: 1.5, Drafting: 1.4, Contract: 1.3, Research: 1.2 },
  },
];

/** RRF constant — typical value is 60 */
const RRF_K = 60;

/** Minimum Qdrant cosine score to include a chunk */
const MIN_SCORE_THRESHOLD = 0.25;

/** Base limit per collection per search pass */
const BASE_LIMIT_PER_COLLECTION = 6;
const BOOSTED_LIMIT_PER_COLLECTION = 10;

@Injectable()
export class LegalRetriever {
  private readonly logger = new Logger(LegalRetriever.name);

  constructor(
    private readonly qdrantService: QdrantService,
    private readonly embedProvider: BgeM3Provider,
    private readonly legalRetrievalService: LegalRetrievalService,
  ) {}

  async retrieve(
    expanded: ExpandedQueries,
    intent: LegalIntent,
    userId?: string,
  ): Promise<RetrievedAuthority[]> {
    const central = await this.legalRetrievalService.retrieveLegalContext(expanded.original || expanded.rewrittenQuery, 12);
    if (central.provisions.length > 0) {
      this.logger.debug(`Central legal retrieval supplied ${central.provisions.length} provision(s).`);
      return central.provisions.map((provision) => this.provisionToAuthority(provision));
    }

    if (central.detectedActId && central.detectedNumber) {
      this.logger.warn(`Central legal retrieval found no exact provision for act_id=${central.detectedActId} ${central.detectedType}=${central.detectedNumber}; refusing legacy broad retrieval.`);
      return [];
    }
    if (!this.embedProvider.isAvailable()) {
      this.logger.warn('Retrieval skipped: no embedding provider available.');
      return [];
    }

    // Embed the primary (rewritten) query
    let primaryVector: number[];
    try {
      primaryVector = await this.embedProvider.generateEmbedding(expanded.rewrittenQuery);
    } catch (err) {
      this.logger.error(`Primary embedding failed: ${this.msg(err)}`);
      return [];
    }

    // Build all search passes: primary + HyDE + sub-queries
    const searchPasses: Array<{ label: string; vector: number[] }> = [
      { label: 'primary', vector: primaryVector },
    ];

    if (expanded.hydeVector) {
      searchPasses.push({ label: 'hyde', vector: expanded.hydeVector });
    }

    for (const [idx, subQuery] of expanded.subQueries.entries()) {
      try {
        const vec = await this.embedProvider.generateEmbedding(subQuery);
        searchPasses.push({ label: `sub_${idx}`, vector: vec });
      } catch {
        // Sub-query embedding failures are non-fatal
      }
    }

    this.logger.debug(`Retrieval: ${searchPasses.length} search pass(es) across ${COLLECTIONS.length} collections`);

    // Priority 1: search uploaded documents first when userId is available
    const userDocResults: RetrievedAuthority[] = [];
    if (userId) {
      for (const pass of searchPasses) {
        const userHits = await this.searchAllCollections(pass.vector, intent, userId, pass.label, ['user_documents']);
        userDocResults.push(...userHits);
      }
    }

    // Execute remaining collection searches in parallel
    const allPassResults = await Promise.all(
      searchPasses.map((pass) => this.searchAllCollections(pass.vector, intent, userId, pass.label)),
    );

    // Flatten per-pass ranked lists for RRF, with user documents prepended for priority
    const rrfMerged = this.reciprocalRankFusion([userDocResults, ...allPassResults]);

    this.logger.debug(`Retrieval: ${rrfMerged.length} unique chunks after RRF merge`);
    return rrfMerged.slice(0, 48);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Search one pass across all collections
  // ──────────────────────────────────────────────────────────────────────────

  private provisionToAuthority(provision: LegalProvisionContext): RetrievedAuthority {
    return {
      id: `legal_corpus:${provision.id}`,
      collection: 'Bare Acts',
      collectionName: QdrantService.COLLECTION,
      title: `${provision.actName}${provision.section ? ` Section ${provision.section}` : ''}${provision.title ? ` - ${provision.title}` : ''}`,
      citation: provision.section ? `${provision.actName}, Section ${provision.section}` : provision.actName,
      section: provision.section || undefined,
      chunkText: provision.content,
      retrievalScore: provision.score,
      rerankerScore: provision.score,
      authorityStrength: 0.96,
      metadata: {
        source: 'central_legal_retrieval',
        act_id: provision.actId,
        act_name: provision.actName,
        category: provision.category,
        part: provision.part,
        chapter: provision.chapter,
        section: provision.section,
        subsection: provision.subsection,
        clause: provision.clause,
        title: provision.title,
        keywords: provision.keywords,
      },
    };
  }
  private async searchAllCollections(
    vector: number[],
    intent: LegalIntent,
    userId: string | undefined,
    passLabel: string,
    onlyCollections?: string[],
  ): Promise<RetrievedAuthority[]> {
    const client = this.qdrantService.getClient();
    const hits: RetrievedAuthority[] = [];
    const collections = onlyCollections
      ? COLLECTIONS.filter((c) => onlyCollections.includes(c.name))
      : COLLECTIONS;

    await Promise.all(
      collections.map(async (collection) => {
        const affinity = collection.intentAffinity[intent] ?? 1.0;
        const limit = affinity >= 1.3
          ? BOOSTED_LIMIT_PER_COLLECTION
          : BASE_LIMIT_PER_COLLECTION;

        const filter =
          collection.name === 'user_documents' && userId
            ? { must: [{ key: 'user_id', match: { value: userId } }] }
            : undefined;

        try {
          const results = await client.search(collection.name, {
            vector,
            limit,
            with_payload: true,
            filter,
          });

          for (const result of results) {
            const rawScore = Number(result.score ?? 0);
            if (rawScore < MIN_SCORE_THRESHOLD) continue;

            const payload = (result.payload ?? {}) as Record<string, any>;
            const chunkText = this.extractText(payload);
            if (!chunkText) continue;

            hits.push({
              id: `${collection.name}:${String(result.id)}`,
              collection: collection.label,
              collectionName: collection.name,
              title: this.extractTitle(collection.label, payload, result.id),
              citation: this.firstStr(payload.citation, payload.neutralCitation, payload.caseCitation),
              court: this.firstStr(payload.court, payload.courtName),
              date: this.firstStr(payload.date, payload.judgmentDate, payload.year),
              benchStrength: Number(payload.benchStrength ?? payload.bench_size ?? 0) || undefined,
              sourceDocument: this.firstStr(payload.sourceDocument, payload.documentName, payload.fileName),
              page: this.firstStr(payload.page, payload.pageNumber),
              section: this.firstStr(payload.section, payload.sectionNumber),
              article: this.firstStr(payload.article, payload.articleNumber),
              chunkText,
              retrievalScore: rawScore,
              rerankerScore: rawScore, // overwritten by Reranker stage
              authorityStrength: collection.authorityStrength,
              metadata: payload,
            });
          }
        } catch (err) {
          this.logger.warn(`Qdrant search failed [${passLabel}/${collection.name}]: ${this.msg(err)}`);
        }
      }),
    );

    return hits.sort((a, b) => b.retrievalScore - a.retrievalScore);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Reciprocal Rank Fusion
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * RRF merges multiple ranked lists into one combined ranked list.
   * Score for a document d: Σ 1 / (k + rank(d, list_i)) for each list_i.
   * This is ordering-based, not score-based, so it is robust to scale
   * differences between dense and HyDE vectors.
   */
  private reciprocalRankFusion(passedLists: RetrievedAuthority[][]): RetrievedAuthority[] {
    const rrfScores = new Map<string, number>();
    const authorityMap = new Map<string, RetrievedAuthority>();

    for (const list of passedLists) {
      list.forEach((authority, rank) => {
        const score = 1 / (RRF_K + rank + 1);
        rrfScores.set(authority.id, (rrfScores.get(authority.id) ?? 0) + score);
        // Keep the highest-scored raw version for metadata
        const existing = authorityMap.get(authority.id);
        if (!existing || authority.retrievalScore > existing.retrievalScore) {
          authorityMap.set(authority.id, authority);
        }
      });
    }

    return Array.from(rrfScores.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([id, rrfScore]) => {
        const authority = authorityMap.get(id)!;
        // Store the RRF score as the retrieval score for the reranker to use
        return { ...authority, retrievalScore: rrfScore };
      });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Payload extraction helpers
  // ──────────────────────────────────────────────────────────────────────────

  private extractText(payload: Record<string, any>): string {
    return (
      this.firstStr(
        payload.text,
        payload.content,
        payload.pageContent,
        payload.chunk,
        payload.summary,
        payload.body,
      )
        ?.replace(/\s+/g, ' ')
        .trim() ?? ''
    );
  }

  private extractTitle(
    collection: AuthorityCollection,
    payload: Record<string, any>,
    pointId: unknown,
  ): string {
    return (
      this.firstStr(
        payload.title,
        payload.name,
        payload.caseName,
        payload.actName,
        payload.documentName,
        payload.fileName,
      ) ?? `${collection} #${String(pointId)}`
    );
  }

  private firstStr(...values: unknown[]): string | undefined {
    for (const v of values) {
      if (typeof v === 'string' && v.trim()) return v.trim();
      if (typeof v === 'number') return String(v);
    }
    return undefined;
  }

  private msg(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}




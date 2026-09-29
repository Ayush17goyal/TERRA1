import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QdrantService } from './qdrant.service';
import { BgeM3Provider } from './bge-m3.provider';
import { ActRegistry, ActRegistryEntry } from './act-registry';
import { ParsedProvisionEntity } from '../ingestion/entities/parsed-provision.entity';

export interface LegalProvisionContext {
  id: string;
  actId: string;
  actName: string;
  actShortName: string;
  category: string;
  part: string;
  chapter: string;
  section: string;
  article: string;
  subsection: string;
  clause: string;
  title: string;
  content: string;
  documentType: string;
  jurisdiction: string;
  year: number | null;
  source: string;
  keywords: string[];
  score: number;
}

export interface RetrievalLog {
  userQuery: string;
  detectedIntent: string;
  detectedAct: string | null;
  detectedActId: string | null;
  detectedSection: string | null;
  detectedArticle: string | null;
  detectedSubsection: string | null;
  detectedClause: string | null;
  detectedChapter: string | null;
  detectedTopic: string | null;
  documentType: string | null;
  queryType: string;
  strategy: 'exact-sql' | 'qdrant-exact' | 'qdrant-filtered' | 'qdrant-semantic' | 'none';
  sqlQuery: string | null;
  rowsReturned: number;
  qdrantFilter: Record<string, any> | null;
  retrievedCollection: string | null;
  retrievedDocuments: string[];
  metadataMatch: boolean;
  similarityScore: number;
  retrievedAct: string | null;
  retrievedActId: string | null;
  retrievedSection: string | null;
  provisionsFound: number;
  topScore: number;
  confidence: 'high' | 'medium' | 'low' | 'none';
  promptContext: string;
  failureReason: string | null;
}

export interface LegalRetrievalResponse {
  detectedActId: string | null;
  detectedActName: string | null;
  detectedType: string;
  detectedNumber: string | null;
  provisions: LegalProvisionContext[];
  log: RetrievalLog;
}

interface ParsedLegalQuery {
  act: ActRegistryEntry | null;
  actName: string | null;
  section: string | null;
  article: string | null;
  subsection: string | null;
  clause: string | null;
  chapter: string | null;
  topic: string | null;
  documentType: 'Bare Act' | 'Constitution' | 'Unknown';
  queryType: 'statutory_explanation' | 'constitutional_article' | 'act_overview' | 'semantic_legal_query';
  detectedType: string;
  detectedNumber: string | null;
}

@Injectable()
export class LegalRetrievalService {
  private readonly logger = new Logger(LegalRetrievalService.name);

  constructor(
    private readonly qdrantService: QdrantService,
    private readonly bgeM3Provider: BgeM3Provider,
    @InjectRepository(ParsedProvisionEntity)
    private readonly parsedProvisionRepository: Repository<ParsedProvisionEntity>,
  ) {}

  async retrieveLegalContext(query: string, limit = 5): Promise<LegalRetrievalResponse> {
    const intent = this.parseQueryIntent(query);
    const log = this.createLog(query, intent);

    this.logger.log(
      `Legal retrieval request: ${JSON.stringify({
        query,
        actName: intent.actName,
        actId: log.detectedActId,
        section: log.detectedSection,
        article: log.detectedArticle,
        documentType: log.documentType,
        queryType: log.queryType,
      })}`,
    );

    let provisions: LegalProvisionContext[] = [];

    if (intent.act && (intent.section || intent.article)) {
      provisions = await this.exactSqlLookup(intent, log, limit);
      if (provisions.length > 0) {
        log.confidence = 'high';
        this.finalizeLog(log, provisions);
        return this.buildResponse(intent, provisions, log);
      }

      provisions = await this.exactQdrantPayloadLookup(intent, log, limit);
      if (provisions.length > 0) {
        log.confidence = 'high';
        this.finalizeLog(log, provisions);
        return this.buildResponse(intent, provisions, log);
      }

      provisions = await this.exactCorpusFileLookup(intent, log, limit);
      if (provisions.length > 0) {
        log.confidence = 'high';
        this.finalizeLog(log, provisions);
        return this.buildResponse(intent, provisions, log);
      }

      await this.diagnoseExactMiss(intent, log);
      this.logger.warn(
        `Exact statutory retrieval returned zero rows for act_id=${intent.act.actId} ` +
        `${intent.article ? 'article=' + intent.article : 'section=' + intent.section}; ${log.failureReason || 'no diagnostic reason available'}`,
      );
      log.confidence = 'none';
      this.finalizeLog(log, []);
      return this.buildResponse(intent, [], log);
    }

    if (intent.act) {
      provisions = await this.filteredSemanticRetrieval(query, intent, log, limit);
      log.confidence = provisions.length > 0 ? 'medium' : 'none';
      this.finalizeLog(log, provisions);
      return this.buildResponse(intent, provisions, log);
    }

    provisions = await this.globalSemanticRetrieval(query, log, limit);
    log.confidence = provisions.length > 0 ? 'low' : 'none';
    this.finalizeLog(log, provisions);
    return this.buildResponse(intent, provisions, log);
  }

  parseQueryIntent(query: string): ParsedLegalQuery {
    const articleMatch = query.match(/\b(?:article|art\.?)\s*(\d+[A-Za-z]*)/i);
    const article = articleMatch ? this.normalizeProvisionNumber(articleMatch[1]) : null;

    let act = ActRegistry.resolve(query);
    if (!act && article) {
      act = ActRegistry.resolve('Constitution of India');
    }

    const sectionMatch =
      query.match(/\bsec(?:tion)?\s*\.?\s*(\d+[A-Za-z]*)/i) ||
      query.match(/\bs\.\s*(\d+[A-Za-z]*)/i);
    const section = sectionMatch ? this.normalizeProvisionNumber(sectionMatch[1]) : null;

    const subsectionMatch =
      query.match(/\bsec(?:tion)?\s*\.?\s*\d+[A-Za-z]*\s*\(\s*(\d+)\s*\)/i) ||
      query.match(/\bsub-?section\s*\(?\s*(\d+)\s*\)?/i);
    const subsection = subsectionMatch ? this.normalizeProvisionNumber(subsectionMatch[1]) : null;

    const clauseMatch =
      query.match(/\bclause\s*\(?\s*([a-z]{1,2})\s*\)?/i) ||
      query.match(/\bsec(?:tion)?\s*\d+[A-Za-z]*\s*\(\d+\)\s*\(\s*([a-z]{1,2})\s*\)/i);
    const clause = clauseMatch ? clauseMatch[1].toLowerCase() : null;

    const chapterMatch = query.match(/\bch(?:apter)?\s*([IVXLCDM\d]+)/i);
    const chapter = chapterMatch ? chapterMatch[1].toUpperCase() : null;

    const documentType: 'Bare Act' | 'Constitution' | 'Unknown' = article ? 'Constitution' : section || act ? 'Bare Act' : 'Unknown';

    let queryType: any = 'semantic_legal_query';
    const isExplain = /\b(?:explain|describe|analyze|meaning|understanding|discuss)\b/i.test(query);
    const isDraft = /\b(?:draft|legislative|provision|bill)\b/i.test(query);

    if (isDraft) {
      queryType = 'legislative_drafting';
    } else if (article) {
      queryType = isExplain ? 'constitutional_explanation' : 'constitutional_lookup';
    } else if (section) {
      queryType = isExplain ? 'statutory_explanation' : 'statutory_lookup';
    } else if (act) {
      queryType = 'act_overview';
    }

    let detectedType = 'unknown';
    let detectedNumber: string | null = null;
    if (clause) { detectedType = 'clause'; detectedNumber = clause; }
    else if (subsection) { detectedType = 'subsection'; detectedNumber = subsection; }
    else if (section) { detectedType = 'section'; detectedNumber = section; }
    else if (article) { detectedType = 'article'; detectedNumber = article; }
    else if (chapter) { detectedType = 'chapter'; detectedNumber = chapter; }
    else if (act) { detectedType = 'act'; }
    else if (/\brule\s*\d+/i.test(query)) { detectedType = 'rule'; }
    else if (/\bschedule\b/i.test(query)) { detectedType = 'schedule'; }

    return {
      act,
      actName: act?.officialName ?? null,
      section,
      article,
      subsection,
      clause,
      chapter,
      topic: this.extractTopic(query),
      documentType,
      queryType,
      detectedType,
      detectedNumber,
    };
  }

  private createLog(query: string, intent: ParsedLegalQuery): RetrievalLog {
    return {
      userQuery: query,
      detectedIntent: intent.detectedType,
      detectedAct: intent.act?.officialName ?? null,
      detectedActId: intent.act?.actId ?? null,
      detectedSection: intent.section,
      detectedArticle: intent.article,
      detectedSubsection: intent.subsection,
      detectedClause: intent.clause,
      detectedChapter: intent.chapter,
      detectedTopic: intent.topic,
      documentType: intent.documentType,
      queryType: intent.queryType,
      strategy: 'none',
      sqlQuery: null,
      rowsReturned: 0,
      qdrantFilter: null,
      retrievedCollection: null,
      retrievedDocuments: [],
      metadataMatch: false,
      similarityScore: 0,
      retrievedAct: null,
      retrievedActId: null,
      retrievedSection: null,
      provisionsFound: 0,
      topScore: 0,
      confidence: 'none',
      promptContext: '',
      failureReason: null,
    };
  }

  private async exactSqlLookup(intent: ParsedLegalQuery, log: RetrievalLog, limit: number): Promise<LegalProvisionContext[]> {
    log.strategy = 'exact-sql';
    const actId = intent.act!.actId;
    const sectionValues = this.exactProvisionKeys(intent);
    log.sqlQuery = 'SELECT * FROM parsed_provisions WHERE act_id = ? AND section IN (?)';

    const rowsById: ParsedProvisionEntity[] = [];
    for (const section of sectionValues) {
      const rows = await this.parsedProvisionRepository.find({
        where: {
          actId,
          section,
          ...(intent.subsection ? { subsection: intent.subsection } : {}),
          ...(intent.clause ? { clause: intent.clause } : {}),
        },
        take: limit,
        order: { subsection: 'ASC', clause: 'ASC' },
      });
      rowsById.push(...rows);
    }

    log.rowsReturned = rowsById.length;
    let isolated = this.validateActIsolation(intent, this.dedupeRows(rowsById).map((row) => this.entityToContext(row, 1, intent)));
    if (isolated.length > 0) return isolated.slice(0, limit);

    const rowsBySection: ParsedProvisionEntity[] = [];
    for (const section of sectionValues) {
      const rows = await this.parsedProvisionRepository.find({
        where: {
          section,
          ...(intent.subsection ? { subsection: intent.subsection } : {}),
          ...(intent.clause ? { clause: intent.clause } : {}),
        },
        take: limit * 5,
        order: { subsection: 'ASC', clause: 'ASC' },
      });
      rowsBySection.push(...rows);
    }

    isolated = this.validateActIsolation(intent, this.dedupeRows(rowsBySection).map((row) => this.entityToContext(row, 1, intent)));
    log.rowsReturned += isolated.length;
    return isolated.slice(0, limit);
  }

  private async exactQdrantPayloadLookup(intent: ParsedLegalQuery, log: RetrievalLog, limit: number): Promise<LegalProvisionContext[]> {
    const client: any = this.qdrantService.getClient();
    if (!client?.scroll) return [];

    log.strategy = 'qdrant-exact';
    const filters = this.exactQdrantFilters(intent);

    for (const filter of filters) {
      log.qdrantFilter = filter;
      try {
        const response = await client.scroll(QdrantService.COLLECTION, {
          filter,
          limit,
          with_payload: true,
          with_vector: false,
        });
        const points = Array.isArray(response?.points) ? response.points : [];
        const provisions = this.validateActIsolation(
          intent,
          points.map((point: any) => this.payloadToContext(String(point.id), point.payload || {}, 1, intent)),
        );
        if (provisions.length > 0) return provisions.slice(0, limit);
      } catch (err: any) {
        this.logger.warn(`Exact Qdrant payload retrieval failed: ${err.message}`);
        return [];
      }
    }

    return [];
  }

  private async exactCorpusFileLookup(intent: ParsedLegalQuery, log: RetrievalLog, limit: number): Promise<LegalProvisionContext[]> {
    if (!intent.act || (!intent.section && !intent.article)) return [];

    const corpusRoot = this.resolveCorpusRoot();
    if (!corpusRoot) return [];

    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name === 'parsed-sections.json') files.push(full);
      }
    };

    walk(corpusRoot);
    const wantedKeys = new Set(this.exactProvisionKeys(intent));

    for (const file of files) {
      try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
        const officialName = parsed.officialName || parsed.actName || '';
        const entry = ActRegistry.resolveByName(officialName);
        const sameAct = entry.actId === intent.act.actId || this.normalizeActName(officialName) === this.normalizeActName(intent.act.officialName);
        if (!sameAct) continue;

        const matches = this.findExactProvisionNodes(parsed.structure || [], intent);

        if (!matches.length) continue;

        log.strategy = 'exact-sql';
        log.sqlQuery = 'corpus-data parsed-sections.json exact provision lookup';
        log.rowsReturned = matches.length;
        log.qdrantFilter = null;
        log.retrievedCollection = 'corpus-data';

        return matches.slice(0, limit).map((match, index) => {
          const section = match.node.type === 'article' ? `Article ${match.node.number}` : String(match.node.number || '');
          return {
            id: `corpus-file:${path.relative(corpusRoot, file)}:${section}:${index}`,
            actId: entry.actId,
            actName: officialName || intent.act!.officialName,
            actShortName: parsed.shortName || entry.shortName,
            category: parsed.category || '',
            part: match.part,
            chapter: match.chapter,
            section,
            article: match.node.type === 'article' ? String(match.node.number || '') : '',
            subsection: '',
            clause: '',
            title: match.node.title || '',
            content: this.renderCorpusNode(match.node),
            documentType: match.node.type === 'article' ? 'Constitution' : 'Bare Act',
            jurisdiction: 'India',
            year: parsed.year || entry.year || null,
            source: file,
            keywords: [],
            score: 1,
          };
        });
      } catch (err: any) {
        this.logger.warn(`Corpus file exact lookup skipped ${file}: ${err.message}`);
      }
    }

    return [];
  }
  private async diagnoseExactMiss(intent: ParsedLegalQuery, log: RetrievalLog): Promise<void> {
    if (!intent.act || (!intent.section && !intent.article)) return;

    const actId = intent.act.actId;
    const provisionNumber = intent.article || intent.section || '';
    const canonicalName = intent.act.officialName;
    const actNameNeedle = canonicalName.replace(/,\s*\d{4}$/, '').toLowerCase();
    const manager = this.parsedProvisionRepository.manager;

    const actRows = await manager.query(
      'SELECT act_id, act_name, COUNT(*) AS n FROM parsed_provisions WHERE act_id = ? OR lower(act_name) LIKE ? GROUP BY act_id, act_name ORDER BY n DESC',
      [actId, '%' + actNameNeedle + '%'],
    );
    const sectionRows = await manager.query(
      'SELECT id, act_id, act_name, section, title, length(content) AS len, embedding_synced, embedding_version, pdf_source FROM parsed_provisions WHERE section IN (?, ?) AND (act_id = ? OR lower(act_name) LIKE ?)',
      [provisionNumber, `Article ${provisionNumber}`, actId, '%' + actNameNeedle + '%'],
    );
    const legalActRows = await manager.query(
      'SELECT act_id, act_name, short_name, file_path, pdf_hash FROM legal_acts WHERE act_id = ? OR lower(act_name) LIKE ? OR lower(file_path) LIKE ?',
      [actId, '%' + actNameNeedle + '%', '%' + actNameNeedle + '%'],
    );

    const details: string[] = [];
    details.push('Detected Act: ' + canonicalName);
    details.push('Resolved act_id: ' + actId);
    details.push('Detected provision: ' + (intent.article ? 'Article ' : 'Section ') + provisionNumber);
    details.push('SQLite exact rows returned: ' + log.rowsReturned);

    if (actRows.length > 0) {
      details.push('SQLite contains Act-like rows: ' + actRows.map((row: any) => row.n + " row(s) as act_name='" + row.act_name + "', act_id='" + (row.act_id || '(blank)') + "'").join('; '));
    } else {
      details.push("SQLite contains no rows for act_id='" + actId + "' or act_name similar to '" + actNameNeedle + "'.");
    }

    if (sectionRows.length > 0) {
      details.push('Provision exists in SQLite metadata: ' + sectionRows.map((row: any) => 'id=' + row.id + ", act_name='" + row.act_name + "', act_id='" + (row.act_id || '(blank)') + "', section='" + row.section + "', title='" + row.title + "', embedding_synced=" + row.embedding_synced).join('; '));
    } else if (actRows.length > 0) {
      details.push('The Act exists in SQLite, but the requested provision was not found for that Act metadata.');
    }

    if (legalActRows.length > 0) {
      details.push('legal_acts metadata: ' + legalActRows.map((row: any) => "act_name='" + row.act_name + "', act_id='" + (row.act_id || '(blank)') + "', pdf_hash='" + (row.pdf_hash || '(null)') + "'").join('; '));
    }

    const qdrantDetails = await this.countQdrantDiagnostics(intent);
    if (qdrantDetails) details.push(qdrantDetails);

    const staleRows = sectionRows.some((row: any) => !row.act_id || row.act_id !== actId);
    const unsyncedRows = sectionRows.some((row: any) => !row.embedding_synced);
    const storedNameDiffers = sectionRows.some((row: any) => row.act_name && this.normalizeActName(row.act_name) !== this.normalizeActName(canonicalName));

    if (staleRows || unsyncedRows || storedNameDiffers) {
      details.push("Root cause: stale or incomplete statutory metadata. The provision appears to exist, but act_id/section metadata is not exact enough for strict retrieval. Re-run corpus synchronization/backfill with structured Bare Act metadata.");
    } else {
      details.push('Root cause: exact provision is absent from the act-scoped legal database/vector payloads; corpus synchronization must ingest this provision before retrieval can answer.');
    }

    log.failureReason = details.join(' | ');
  }

  private async countQdrantDiagnostics(intent: ParsedLegalQuery): Promise<string | null> {
    if (!intent.act) return null;
    try {
      const client = this.qdrantService.getClient();
      const filters = this.exactQdrantFilters(intent);
      const counts: string[] = [];
      for (const filter of filters.slice(0, 3)) {
        const result = await client.count(QdrantService.COLLECTION, { exact: true, filter });
        counts.push(JSON.stringify(filter.must) + '=' + result.count);
      }
      return 'Qdrant legal_corpus exact payload counts: ' + counts.join(', ') + '.';
    } catch (err: any) {
      return 'Qdrant diagnostic unavailable: ' + err.message;
    }
  }

  private async filteredSemanticRetrieval(query: string, intent: ParsedLegalQuery, log: RetrievalLog, limit: number): Promise<LegalProvisionContext[]> {
    log.strategy = 'qdrant-filtered';
    const filterMust: any[] = [{ key: 'act_id', match: { value: intent.act!.actId } }];
    if (intent.section) filterMust.push({ key: 'section', match: { value: intent.section } });
    if (intent.article) filterMust.push({ key: 'section', match: { value: `Article ${intent.article}` } });
    if (intent.chapter) filterMust.push({ key: 'chapter', match: { value: intent.chapter } });
    if (intent.subsection) filterMust.push({ key: 'subsection', match: { value: intent.subsection } });
    if (intent.clause) filterMust.push({ key: 'clause', match: { value: intent.clause } });

    log.qdrantFilter = { must: filterMust };

    try {
      const queryVector = await this.bgeM3Provider.generateEmbedding(query);
      const results = (await this.qdrantService.getClient().search(QdrantService.COLLECTION, {
        vector: queryVector,
        limit,
        filter: { must: filterMust },
        with_payload: true,
      })) || [];

      return this.validateActIsolation(intent, results.map((hit) => this.payloadToContext(String(hit.id), hit.payload as any, Number(hit.score ?? 0), intent)));
    } catch (err: any) {
      this.logger.warn(`Filtered Qdrant retrieval failed: ${err.message}`);
      return [];
    }
  }

  private async globalSemanticRetrieval(query: string, log: RetrievalLog, limit: number): Promise<LegalProvisionContext[]> {
    log.strategy = 'qdrant-semantic';
    try {
      const queryVector = await this.bgeM3Provider.generateEmbedding(query);
      const results = (await this.qdrantService.getClient().search(QdrantService.COLLECTION, {
        vector: queryVector,
        limit,
        with_payload: true,
      })) || [];
      return results.map((hit) => this.payloadToContext(String(hit.id), hit.payload as any, Number(hit.score ?? 0)));
    } catch (err: any) {
      this.logger.warn(`Global Qdrant retrieval failed: ${err.message}`);
      return [];
    }
  }

  private validateActIsolation(intent: ParsedLegalQuery, provisions: LegalProvisionContext[]): LegalProvisionContext[] {
    if (!intent.act) return provisions;
    const filtered = provisions
      .map((provision) => {
        const resolved = provision.actId ? ActRegistry.resolveByName(provision.actName) : ActRegistry.resolveByName(provision.actName);
        const resolvedActId = provision.actId || resolved.actId;
        return { ...provision, actId: resolvedActId };
      })
      .filter((provision) => {
        if (provision.actId === intent.act!.actId) return true;
        return this.normalizeActName(provision.actName) === this.normalizeActName(intent.act!.officialName);
      });

    if (filtered.length !== provisions.length) {
      this.logger.error(`Act isolation blocked mismatched retrieval: requested=${intent.act.actId} retrieved=${provisions.map((p) => p.actId || p.actName).join(',')}`);
    }
    return filtered;
  }

  private entityToContext(p: ParsedProvisionEntity, score: number, intent?: ParsedLegalQuery): LegalProvisionContext {
    const registryEntry = ActRegistry.resolveByName(p.actName);
    const article = this.extractArticleFromStoredSection(p.section);
    return {
      id: p.id,
      actId: p.actId || registryEntry.actId,
      actName: p.actName || registryEntry.officialName,
      actShortName: registryEntry.shortName,
      category: p.category,
      part: p.part || '',
      chapter: p.chapter || '',
      section: p.section || '',
      article: article || intent?.article || '',
      subsection: p.subsection || '',
      clause: p.clause || '',
      title: p.title || '',
      content: p.content,
      documentType: article ? 'Constitution' : 'Bare Act',
      jurisdiction: 'India',
      year: registryEntry.year ?? null,
      source: p.pdfSource,
      keywords: p.keywords || [],
      score,
    };
  }

  private payloadToContext(id: string, payload: any, score: number, intent?: ParsedLegalQuery): LegalProvisionContext {
    const actName = String(payload.act_name || payload.actName || '');
    const registryEntry = ActRegistry.resolveByName(actName || intent?.act?.officialName || '');
    const section = String(payload.section_number || payload.section || payload.sectionNumber || '');
    const article = String(payload.article_number || payload.article || payload.articleNumber || this.extractArticleFromStoredSection(section) || intent?.article || '');
    return {
      id,
      actId: String(payload.act_id || payload.actId || registryEntry.actId),
      actName: actName || registryEntry.officialName,
      actShortName: String(payload.act_short_name || payload.short_name || registryEntry.shortName),
      category: String(payload.category || ''),
      part: String(payload.part || ''),
      chapter: String(payload.chapter || ''),
      section,
      article,
      subsection: String(payload.subsection || ''),
      clause: String(payload.clause || ''),
      title: String(payload.title || ''),
      content: String(payload.text || payload.content || ''),
      documentType: String(payload.document_type || payload.documentType || (article ? 'Constitution' : 'Bare Act')),
      jurisdiction: String(payload.jurisdiction || 'India'),
      year: Number(payload.year || registryEntry.year || 0) || null,
      source: String(payload.source || payload.pdf_source || payload.sourceDocument || ''),
      keywords: Array.isArray(payload.keywords) ? payload.keywords : [],
      score,
    };
  }

  private buildResponse(intent: ParsedLegalQuery, provisions: LegalProvisionContext[], log: RetrievalLog): LegalRetrievalResponse {
    return {
      detectedActId: intent.act?.actId ?? null,
      detectedActName: intent.act?.officialName ?? null,
      detectedType: intent.detectedType,
      detectedNumber: intent.detectedNumber,
      provisions,
      log,
    };
  }

  private finalizeLog(log: RetrievalLog, provisions: LegalProvisionContext[]): void {
    log.provisionsFound = provisions.length;
    log.topScore = provisions[0]?.score ?? 0;
    log.similarityScore = provisions[0]?.score ?? 0;
    log.retrievedAct = provisions[0]?.actName ?? null;
    log.retrievedActId = provisions[0]?.actId ?? null;
    log.retrievedSection = provisions[0]?.section ?? null;
    log.retrievedCollection = provisions.length ? (log.retrievedCollection || QdrantService.COLLECTION) : log.retrievedCollection;
    log.retrievedDocuments = provisions.map((p) => [p.actName, p.article ? `Article ${p.article}` : p.section ? `Section ${p.section}` : '', p.title].filter(Boolean).join(' '));
    log.metadataMatch = provisions.length > 0 && (!log.detectedActId || provisions.every((p) => p.actId === log.detectedActId));
    log.promptContext = provisions.map((p) => {
      const label = p.article ? `Article ${p.article}` : `Section ${p.section}`;
      return [
        `Act: ${p.actName}`,
        `Provision: ${label}`,
        `Title: ${p.title}`,
        `Source: ${p.source}`,
        `Evidence:\n${p.content}`,
      ].filter(Boolean).join('\n');
    }).join('\n\n---\n\n').slice(0, 8000);

    if (log.detectedActId && provisions.some((p) => p.actId !== log.detectedActId)) {
      log.confidence = 'none';
      log.provisionsFound = 0;
      log.promptContext = '';
      log.metadataMatch = false;
    }

    this.logger.log(`Legal retrieval audit: ${JSON.stringify({
      userQuery: log.userQuery,
      detectedIntent: log.detectedIntent,
      detectedAct: log.detectedAct,
      detectedActId: log.detectedActId,
      detectedSection: log.detectedSection,
      detectedArticle: log.detectedArticle,
      documentType: log.documentType,
      queryType: log.queryType,
      strategy: log.strategy,
      sqlQuery: log.sqlQuery,
      rowsReturned: log.rowsReturned,
      qdrantFilter: log.qdrantFilter,
      retrievedCollection: log.retrievedCollection,
      retrievedDocuments: log.retrievedDocuments,
      metadataMatch: log.metadataMatch,
      similarityScore: log.similarityScore,
      retrievedAct: log.retrievedAct,
      retrievedActId: log.retrievedActId,
      retrievedSection: log.retrievedSection,
      confidence: log.confidence,
      promptContextChars: log.promptContext.length,
      failureReason: log.failureReason,
    })}`);
  }

  private exactProvisionKeys(intent: ParsedLegalQuery): string[] {
    const keys: string[] = [];
    if (intent.article) {
      keys.push(intent.article, `Article ${intent.article}`, `ARTICLE ${intent.article}`);
    }
    if (intent.section) {
      keys.push(intent.section, `Section ${intent.section}`, `SECTION ${intent.section}`);
    }
    return keys;
  }

  private exactQdrantFilters(intent: ParsedLegalQuery): Array<{ must: any[] }> {
    if (!intent.act) return [];

    const actKeys = [
      { key: 'act_id', match: { value: intent.act.actId } },
      { key: 'act_name', match: { value: intent.act.officialName } },
      { key: 'actName', match: { value: intent.act.officialName } },
      { key: 'act_short_name', match: { value: intent.act.shortName } },
      { key: 'short_name', match: { value: intent.act.shortName } },
    ];

    const targetNumber = intent.article || intent.section || '';
    const sectionKeys = [
      { key: 'section_number', match: { value: targetNumber } },
      { key: 'sectionNumber', match: { value: targetNumber } },
      { key: 'section', match: { value: targetNumber } },
      { key: 'section', match: { value: (intent.article ? 'Article ' : 'Section ') + targetNumber } },
      ...(intent.article ? [{ key: 'article_number', match: { value: intent.article } }] : []),
    ];

    const filters: Array<{ must: any[] }> = [];
    for (const actKey of actKeys) {
      for (const sectionKey of sectionKeys) {
        filters.push({ must: [actKey, sectionKey] });
      }
    }
    return filters;
  }

  private resolveCorpusRoot(): string | null {
    const candidates = [
      path.resolve(process.cwd(), 'corpus-data'),
      path.resolve(process.cwd(), 'server', 'corpus-data'),
      path.resolve(__dirname, '..', '..', '..', 'corpus-data'),
      path.resolve(__dirname, '..', '..', '..', '..', 'server', 'corpus-data'),
    ];
    return candidates.find((candidate) => fs.existsSync(candidate)) || null;
  }
  private findExactProvisionNodes(nodes: any[], intent: ParsedLegalQuery, context: { part: string; chapter: string } = { part: '', chapter: '' }): Array<{ node: any; part: string; chapter: string }> {
    const matches: Array<{ node: any; part: string; chapter: string }> = [];
    for (const node of nodes || []) {
      const nextContext = {
        part: node.type === 'part' ? String(node.number || node.title || '') : context.part,
        chapter: node.type === 'chapter' ? String(node.number || node.title || '') : context.chapter,
      };

      if (intent.section && node.type === 'section' && String(node.number || '').toUpperCase() === intent.section) {
        matches.push({ node, ...nextContext });
      }
      if (intent.article && node.type === 'article' && String(node.number || '').toUpperCase() === intent.article) {
        matches.push({ node, ...nextContext });
      }

      matches.push(...this.findExactProvisionNodes(node.children || [], intent, nextContext));
    }
    return matches;
  }

  private renderCorpusNode(node: any): string {
    const label = node.type === 'article'
      ? `Article ${node.number || ''}`.trim()
      : node.type === 'section'
        ? `Section ${node.number || ''}`.trim()
        : node.type === 'subsection' || node.type === 'clause' || node.type === 'subclause'
          ? `(${node.number || ''})`.trim()
          : node.type ? String(node.type).replace(/_/g, ' ') : '';
    const heading = [label, node.title].filter(Boolean).join(' - ');
    const own = [heading, node.content].filter(Boolean).join('\n').trim();
    const childText = (node.children || []).map((child: any) => this.renderCorpusNode(child)).filter(Boolean).join('\n');
    return [own, childText].filter(Boolean).join('\n').trim();
  }
  private dedupeRows(rows: ParsedProvisionEntity[]): ParsedProvisionEntity[] {
    const seen = new Set<string>();
    return rows.filter((row) => {
      const key = row.id || `${row.actId}:${row.actName}:${row.section}:${row.subsection}:${row.clause}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private normalizeProvisionNumber(value: string): string {
    return value.trim().replace(/\s+/g, '').toUpperCase();
  }

  private extractArticleFromStoredSection(section: string): string {
    const match = String(section || '').match(/^Article\s+(\d+[A-Za-z]*)$/i);
    return match ? this.normalizeProvisionNumber(match[1]) : '';
  }

  private normalizeActName(value: string): string {
    return String(value || '').toLowerCase().replace(/,\s*\d{4}\b/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private extractTopic(query: string): string | null {
    const topic = query
      .replace(/\b(?:explain|what is|define|meaning of|tell me about)\b/gi, ' ')
      .replace(/\b(?:section|sec\.?|s\.|article|art\.?)\s*\d+[A-Za-z]*/gi, ' ')
      .replace(/\b(?:of|under|in|the|act|code|constitution|india|indian)\b/gi, ' ')
      .replace(/[^a-z0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return topic || null;
  }
}

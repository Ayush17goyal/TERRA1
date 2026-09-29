import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { AUTHORITY_SCORES, LegalSource, LegalSourceTier, LegalSourceType } from './legal-source.types';
import { SemanticCacheService } from './semantic-cache.service';

type RawSearchResult = {
  title: string;
  snippet: string;
  url: string;
};

type TrustedTier = {
  tier: LegalSourceTier;
  sourceType: LegalSourceType;
  label: string;
  domains: string[];
  minConfidence: number;
};

@Injectable()
export class LegalSearchFallbackService {
  private readonly logger = new Logger(LegalSearchFallbackService.name);
  private readonly strongQdrantConfidence = 0.75;
  private readonly minAuthoritativeConfidence = 0.6;
  private readonly minGeneralConfidence = 0.7;

  private readonly trustedTiers: TrustedTier[] = [
    {
      tier: 2,
      sourceType: 'supreme_court',
      label: 'Supreme Court Sources',
      domains: ['sci.gov.in', 'main.sci.gov.in'],
      minConfidence: this.minAuthoritativeConfidence,
    },
    {
      tier: 3,
      sourceType: 'india_code',
      label: 'India Code',
      domains: ['indiacode.nic.in'],
      minConfidence: this.minAuthoritativeConfidence,
    },
    {
      tier: 4,
      sourceType: 'law_commission',
      label: 'Law Commission Reports',
      domains: ['lawcommissionofindia.nic.in'],
      minConfidence: this.minAuthoritativeConfidence,
    },
    {
      tier: 5,
      sourceType: 'government_repository',
      label: 'Government Legal Repositories',
      domains: ['legislative.gov.in', 'egazette.nic.in', 'doj.gov.in', 'lawmin.gov.in'],
      minConfidence: this.minAuthoritativeConfidence,
    },
  ];

  private readonly generalLegalDomains = [
    'indiankanoon.org',
    'barandbench.com',
    'livelaw.in',
  ];

  constructor(private readonly cacheService: SemanticCacheService) {}

  async search(query: string, qdrantSources: LegalSource[] = []): Promise<LegalSource[]> {
    const strongQdrantSources = qdrantSources.filter(
      (source) => source.confidenceScore >= this.strongQdrantConfidence,
    );
    if (strongQdrantSources.length > 0) {
      return this.rankAndDedupe(qdrantSources);
    }

    const cached = await this.cacheService.getLegalReferences(query);
    const cachedAuthoritative = (cached || []).filter((source) => source.tier >= 2 && source.tier <= 5);
    const cachedGeneral = (cached || []).filter((source) => source.tier === 6);
    if (cachedAuthoritative.length > 0) {
      return this.rankAndDedupe([...qdrantSources, ...cachedAuthoritative]);
    }

    const discovered: LegalSource[] = [];

    for (const tier of this.trustedTiers) {
      const tierSources = await this.searchTier(query, tier);
      const usableSources = tierSources.filter((source) => source.confidenceScore >= tier.minConfidence);

      if (usableSources.length > 0) {
        discovered.push(...usableSources);
        const ranked = this.rankAndDedupe([...qdrantSources, ...discovered]);
        await this.cacheService.setLegalReferences(query, ranked.filter((source) => source.tier > 1));
        return ranked;
      }
    }

    if (cachedGeneral.length > 0) {
      return this.rankAndDedupe([...qdrantSources, ...cachedGeneral]);
    }

    const generalSources = await this.searchGeneralLegalSources(query);
    const usableGeneralSources = generalSources.filter(
      (source) => source.confidenceScore >= this.minGeneralConfidence,
    );
    const ranked = this.rankAndDedupe([...qdrantSources, ...usableGeneralSources]);
    if (usableGeneralSources.length > 0) {
      await this.cacheService.setLegalReferences(query, usableGeneralSources);
    }
    return ranked;
  }

  fromQdrantHit(params: {
    id: string;
    title: string;
    collection: string;
    score: number;
    excerpt: string;
    metadata: Record<string, any>;
  }): LegalSource {
    const sourceType = this.inferQdrantSourceType(params.collection, params.metadata);
    const authorityScore = sourceType === 'qdrant'
      ? AUTHORITY_SCORES.qdrant
      : Math.max(AUTHORITY_SCORES.qdrant, AUTHORITY_SCORES[sourceType]);
    const normalizedCitation = this.normalizeCitation(
      params.metadata.citation ||
      params.metadata.neutralCitation ||
      params.metadata.caseCitation ||
      params.metadata.actName ||
      params.title,
    );

    return {
      id: params.id,
      title: params.title,
      normalizedCitation,
      sourceType,
      tier: 1,
      authorityScore,
      confidenceScore: this.calculateConfidence(params.score, authorityScore, normalizedCitation, params.excerpt),
      relevanceScore: this.clamp(params.score),
      jurisdiction: 'India',
      url: this.asString(params.metadata.url),
      excerpt: params.excerpt,
      date: this.asString(params.metadata.date || params.metadata.year),
      court: this.asString(params.metadata.court),
      actName: this.asString(params.metadata.actName),
      section: this.asString(params.metadata.section || params.metadata.article),
      reportNumber: this.asString(params.metadata.reportNumber),
      metadata: {
        ...params.metadata,
        collection: params.collection,
      },
    };
  }

  toContextBlock(sources: LegalSource[], limit = 5): string {
    return sources
      .slice(0, limit)
      .map((source, index) => {
        const citation = source.normalizedCitation ? `\nCitation: ${source.normalizedCitation}` : '';
        const url = source.url ? `\nURL: ${source.url}` : '';
        return `[Source ${index + 1}] ${source.title}${citation}\nTier: ${source.tier}\nAuthority: ${source.authorityScore.toFixed(2)}\nConfidence: ${source.confidenceScore.toFixed(2)}${url}\nExcerpt: ${source.excerpt}`;
      })
      .join('\n\n');
  }

  private async searchTier(query: string, tier: TrustedTier): Promise<LegalSource[]> {
    this.logger.log(`Legal fallback tier ${tier.tier}: searching ${tier.label}`);
    const rawResults = await this.searchDuckDuckGo(query, tier.domains, 5);
    return rawResults.map((result, index) => this.toLegalSource(result, tier.sourceType, tier.tier, index));
  }

  private async searchGeneralLegalSources(query: string): Promise<LegalSource[]> {
    this.logger.log('Legal fallback tier 6: searching general legal sources');
    const rawResults = await this.searchDuckDuckGo(query, this.generalLegalDomains, 5);
    return rawResults.map((result, index) => this.toLegalSource(result, 'general_legal_search', 6, index));
  }

  private async searchDuckDuckGo(query: string, domains: string[], limit: number): Promise<RawSearchResult[]> {
    const domainQuery = domains.map((domain) => `site:${domain}`).join(' OR ');
    const searchQuery = `${query} ${domainQuery}`;

    try {
      const response = await axios.get(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.7',
          },
          timeout: 5000,
        },
      );

      const html = String(response.data || '');
      const results: RawSearchResult[] = [];
      const resultBlocks = html.split('<div class="result__body">');

      for (let i = 1; i < resultBlocks.length && results.length < limit; i++) {
        const block = resultBlocks[i];
        const aMatch = block.match(/<a class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
        const snippetMatch = block.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
        if (!aMatch) continue;

        const url = this.decodeDuckDuckGoUrl(aMatch[1]);
        if (!this.isAllowedDomain(url, domains)) continue;

        results.push({
          title: this.stripHtml(aMatch[2]),
          snippet: snippetMatch ? this.stripHtml(snippetMatch[1]) : '',
          url,
        });
      }

      return results;
    } catch (error: any) {
      this.logger.warn(`Trusted legal search failed for "${query}": ${error.message}`);
      return [];
    }
  }

  private toLegalSource(
    result: RawSearchResult,
    sourceType: LegalSourceType,
    tier: LegalSourceTier,
    index: number,
  ): LegalSource {
    const normalizedCitation = this.normalizeCitation(`${result.title} ${result.snippet}`);
    const authorityScore = AUTHORITY_SCORES[sourceType];
    const relevanceScore = this.estimateRelevance(result);

    return {
      id: `${sourceType}-${index}-${this.hash(result.url || result.title).slice(0, 10)}`,
      title: result.title || this.titleFromUrl(result.url),
      normalizedCitation,
      sourceType,
      tier,
      authorityScore,
      confidenceScore: this.calculateConfidence(relevanceScore, authorityScore, normalizedCitation, result.snippet),
      relevanceScore,
      jurisdiction: 'India',
      url: result.url,
      excerpt: result.snippet || result.title,
      court: sourceType === 'supreme_court' ? 'Supreme Court of India' : undefined,
      actName: sourceType === 'india_code' ? this.extractActName(`${result.title} ${result.snippet}`) : undefined,
      section: this.extractSection(`${result.title} ${result.snippet}`),
      reportNumber: sourceType === 'law_commission'
        ? this.extractLawCommissionReport(`${result.title} ${result.snippet}`)
        : undefined,
      metadata: {
        discoveredBy: 'legal-search-fallback',
        host: this.safeHost(result.url),
      },
    };
  }

  private rankAndDedupe(sources: LegalSource[]): LegalSource[] {
    const deduped = new Map<string, LegalSource>();

    for (const source of sources) {
      const key = this.dedupeKey(source);
      const existing = deduped.get(key);
      if (
        !existing ||
        source.authorityScore > existing.authorityScore ||
        (source.authorityScore === existing.authorityScore && source.confidenceScore > existing.confidenceScore)
      ) {
        deduped.set(key, source);
      }
    }

    return [...deduped.values()]
      .sort((a, b) => {
        if (a.tier !== b.tier) return a.tier - b.tier;
        if (b.authorityScore !== a.authorityScore) return b.authorityScore - a.authorityScore;
        return b.confidenceScore - a.confidenceScore;
      })
      .slice(0, 8);
  }

  private calculateConfidence(
    relevanceScore: number,
    authorityScore: number,
    normalizedCitation: string | null,
    excerpt: string,
  ): number {
    const citationQualityScore = normalizedCitation ? 1 : 0.35;
    const specificityScore = /\b(article|section|report|appeal|petition|scc|air|insc|act|rules?)\b/i.test(excerpt || '')
      ? 0.85
      : 0.45;
    return this.clamp(
      this.clamp(relevanceScore) * 0.45 +
      authorityScore * 0.4 +
      citationQualityScore * 0.1 +
      specificityScore * 0.05,
    );
  }

  private estimateRelevance(result: RawSearchResult): number {
    const text = `${result.title} ${result.snippet}`.toLowerCase();
    let score = 0.55;
    if (/\b(supreme court|article|section|act|law commission|report|judgment|judgement|constitution)\b/.test(text)) {
      score += 0.2;
    }
    if (/\b(air|scc|insc|scr|w\.?p\.?|civil appeal|criminal appeal)\b/i.test(text)) {
      score += 0.15;
    }
    if ((result.snippet || '').length > 80) {
      score += 0.1;
    }
    return this.clamp(score);
  }

  private inferQdrantSourceType(collection: string, metadata: Record<string, any>): LegalSourceType {
    const combined = `${collection} ${metadata.source || ''} ${metadata.court || ''} ${metadata.url || ''}`.toLowerCase();
    if (combined.includes('supreme') || combined.includes('sci.gov.in')) return 'supreme_court';
    if (combined.includes('bare_acts') || combined.includes('india code') || combined.includes('indiacode')) return 'india_code';
    if (combined.includes('law commission')) return 'law_commission';
    if (combined.includes('gov.in') || combined.includes('nic.in')) return 'government_repository';
    return 'qdrant';
  }

  private normalizeCitation(value: unknown): string | null {
    const text = this.stripHtml(String(value || '')).replace(/\s+/g, ' ').trim();
    if (!text) return null;

    const patterns = [
      /\bAIR\s+\d{4}\s+SC\s+\d+\b/i,
      /\(\d{4}\)\s+\d+\s+SCC\s+\d+/i,
      /\b\d{4}\s+INSC\s+\d+\b/i,
      /\b(?:Civil|Criminal)\s+Appeal\s+No\.?\s+[\w/-]+(?:\s+of\s+\d{4})?/i,
      /\bW\.?P\.?\s*\(?[A-Z]?\)?\s+No\.?\s+[\w/-]+(?:\s+of\s+\d{4})?/i,
      /\bSection\s+\d+[A-Z]?(?:\([^)]+\))?,?\s+[^.]{0,80}Act,?\s+\d{4}\b/i,
      /\bArticle\s+\d+[A-Z]?\b/i,
      /\bLaw\s+Commission\s+(?:of\s+India\s+)?Report\s+No\.?\s+\d+\b/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return this.canonicalizeCitation(match[0]);
    }

    const caseName = text.match(/\b[A-Z][A-Za-z.&'\s-]{2,80}\s+v\.?s?\.?\s+[A-Z][A-Za-z.&'\s-]{2,80}\b/);
    return caseName ? this.canonicalizeCitation(caseName[0]) : null;
  }

  private canonicalizeCitation(citation: string): string {
    return citation
      .replace(/\bvs\.?\b/i, 'v.')
      .replace(/\bv\b/i, 'v.')
      .replace(/\s+/g, ' ')
      .replace(/\s+,/g, ',')
      .trim();
  }

  private dedupeKey(source: LegalSource): string {
    if (source.normalizedCitation) return `citation:${source.normalizedCitation.toLowerCase()}`;
    if (source.url) return `url:${this.canonicalUrl(source.url)}`;
    return `title:${source.sourceType}:${source.title.toLowerCase()}:${this.hash(source.excerpt).slice(0, 10)}`;
  }

  private decodeDuckDuckGoUrl(url: string): string {
    if (url.includes('uddg=')) {
      const encodedUrl = url.split('uddg=')[1].split('&')[0];
      try {
        return decodeURIComponent(encodedUrl);
      } catch {
        return url;
      }
    }
    return url;
  }

  private isAllowedDomain(url: string, domains: string[]): boolean {
    const host = this.safeHost(url);
    return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  }

  private safeHost(url: string): string {
    try {
      return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  private canonicalUrl(url: string): string {
    try {
      const parsed = new URL(url);
      parsed.hash = '';
      parsed.search = '';
      return parsed.toString().replace(/\/$/, '').toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }

  private titleFromUrl(url: string): string {
    const host = this.safeHost(url);
    return host || 'Legal Source';
  }

  private extractActName(text: string): string | undefined {
    return this.asString(text.match(/\b([A-Z][A-Za-z\s]+Act),?\s+\d{4}\b/)?.[0]);
  }

  private extractSection(text: string): string | undefined {
    return this.asString(text.match(/\b(?:Section|Article)\s+\d+[A-Z]?(?:\([^)]+\))?/i)?.[0]);
  }

  private extractLawCommissionReport(text: string): string | undefined {
    return this.asString(text.match(/\bReport\s+No\.?\s+\d+\b/i)?.[0]);
  }

  private stripHtml(value: string): string {
    return value
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private asString(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined;
    const text = String(value).trim();
    return text || undefined;
  }

  private hash(value: string): string {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  }
}

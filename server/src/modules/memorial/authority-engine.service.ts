import { Injectable, Logger } from '@nestjs/common';
import { VectorSearchService, RetrievalCollection } from '../retrieval/vector-search.service';
import { IssueMatrixItem, MemorialWorkflowOptions, PropositionBlueprint, ResearchAuthority } from './memorial.types';
import { MemorialAiService } from './memorial-ai.service';
import { authorityPrompt, MEMORIAL_SYSTEM } from './memorial-prompts';
import { AuthorityCatalogItem, MEMORIAL_AUTHORITY_CATALOG } from './memorial-authority-catalog';

interface Candidate extends AuthorityCatalogItem {
  candidateId: string;
}

@Injectable()
export class AuthorityEngineService {
  private readonly logger = new Logger(AuthorityEngineService.name);

  constructor(
    private readonly ai: MemorialAiService,
    private readonly vectorSearch: VectorSearchService,
  ) {}

  async generate(issues: IssueMatrixItem[], blueprint: PropositionBlueprint, options: MemorialWorkflowOptions): Promise<{ authorities: ResearchAuthority[]; usedAi: boolean; warning?: string }> {
    const candidates = await this.buildCandidates(issues, blueprint, options);
    try {
      const response = await this.ai.json<any>({
        system: MEMORIAL_SYSTEM,
        prompt: authorityPrompt(
          JSON.stringify(issues.map((i) => ({ id: i.id, issue: i.issue, subIssues: i.subIssues, legalTests: i.legalTests, legalAnchors: i.legalAnchors, authorityQueries: i.authorityQueries }))),
          JSON.stringify(candidates.map((c) => ({ candidateId: c.candidateId, type: c.type, citation: c.citation, proposition: c.proposition, ratioOrRule: c.ratioOrRule, defaultSide: c.defaultSide, verified: c.verified, confidence: c.confidence, keywords: c.keywords }))),
        ),
        options,
        maxTokens: 5000,
        stage: 'authority-ranking',
      });
      const authorities = this.normalizeRankings(response?.rankings, issues, candidates, options);
      if (authorities.length < issues.length * 4) throw new Error('Authority ranking returned insufficient issue coverage.');
      return { authorities, usedAi: true };
    } catch (error: any) {
      this.logger.warn(`Authority ranking fallback used: ${error?.message || error}`);
      return {
        authorities: this.deterministicRank(issues, candidates, options),
        usedAi: false,
        warning: `AI authority ranking unavailable; deterministic verified-authority ranking used: ${error?.message || error}`,
      };
    }
  }

  private async buildCandidates(issues: IssueMatrixItem[], blueprint: PropositionBlueprint, options: MemorialWorkflowOptions): Promise<Candidate[]> {
    const candidates: Candidate[] = MEMORIAL_AUTHORITY_CATALOG.map((item) => ({ ...item, candidateId: item.catalogId }));

    blueprint.lawsMentioned.forEach((law, index) => {
      if (!this.isValidAuthorityCitation(law.citation) || this.isDuplicateCitation(candidates, law.citation)) return;
      candidates.push({
        catalogId: `UP_${index + 1}`,
        candidateId: `UP_${index + 1}`,
        type: /article/i.test(law.citation) ? 'constitution' : /section|act|code|rules/i.test(law.citation) ? 'statute' : 'report',
        citation: law.citation,
        proposition: law.context || `Provision expressly mentioned in the proposition: ${law.citation}`,
        ratioOrRule: law.context || `The scope and elements of ${law.citation} must be applied to the proposition facts.`,
        defaultSide: 'both',
        risk: 'Provision extracted from the uploaded proposition; verify the official text before final filing.',
        confidence: 82,
        verified: true,
        verificationSource: 'uploaded',
        keywords: this.tokens(`${law.citation} ${law.context}`),
      });
    });

    const retrieved = await this.retrieveCandidates(issues, options);
    retrieved.forEach((candidate) => {
      if (!this.isDuplicateCitation(candidates, candidate.citation)) candidates.push(candidate);
    });
    return candidates;
  }

  private async retrieveCandidates(issues: IssueMatrixItem[], options: MemorialWorkflowOptions): Promise<Candidate[]> {
    const sourceNames = options.selectedSources?.length ? options.selectedSources : ['judgments', 'acts', 'law_commission_reports'];
    const collections = sourceNames.map((source) => this.toCollection(source)).filter(Boolean) as RetrievalCollection[];
    const retrieved: Candidate[] = [];
    for (const issue of issues) {
      for (const collection of collections) {
        try {
          const query = [issue.issue, ...issue.authorityQueries].join(' ');
          const hits = await this.vectorSearch.search(collection, query, 4);
          hits.forEach((hit: any, index: number) => {
            const metadata = hit.metadata || {};
            const citation = String(metadata.citation || metadata.case_name || metadata.title || '').trim();
            if (!this.isValidAuthorityCitation(citation)) return;
            const text = String(hit.text || metadata.text || '').replace(/\s+/g, ' ').trim();
            retrieved.push({
              catalogId: `RET_${issue.id}_${collection}_${index}`,
              candidateId: `RET_${issue.id}_${collection}_${index}`,
              type: collection === 'acts' ? 'statute' : collection === 'judgments' ? 'case' : collection === 'law_commission_reports' ? 'report' : 'article',
              citation,
              proposition: text.slice(0, 700),
              ratioOrRule: text.slice(0, 900),
              defaultSide: 'both',
              risk: 'Retrieved from the configured local legal corpus; verify the official text and pinpoint before filing.',
              confidence: Math.round(Math.max(60, Math.min(96, Number(hit.score || 0.7) * 100))),
              verified: true,
              verificationSource: 'retrieval',
              court: metadata.court,
              year: metadata.year ? String(metadata.year) : undefined,
              pinpoint: metadata.pinpoint || metadata.paragraph,
              sourceUrl: metadata.url,
              keywords: this.tokens(`${citation} ${text}`),
            });
          });
        } catch (error: any) {
          this.logger.debug(`Retrieval unavailable for ${collection}: ${error?.message || error}`);
        }
      }
    }
    return retrieved;
  }

  private normalizeRankings(rawRankings: any, issues: IssueMatrixItem[], candidates: Candidate[], options: MemorialWorkflowOptions): ResearchAuthority[] {
    const candidateById = new Map(candidates.map((c) => [c.candidateId, c]));
    const result: ResearchAuthority[] = [];
    const rankings = Array.isArray(rawRankings) ? rawRankings : [];
    for (const issue of issues) {
      const ranking = rankings.find((r: any) => String(r.issueId) === issue.id);
      const rows = Array.isArray(ranking?.authorities) ? ranking.authorities : [];
      rows.slice(0, 12).forEach((row: any) => {
        const candidate = candidateById.get(String(row.candidateId));
        if (!candidate) return;
        if (!candidate.verified && !options.allowUnverifiedAuthorities) return;
        result.push(this.toAuthority(candidate, issue.id, {
          sideUsefulness: this.side(row.sideUsefulness, candidate.defaultSide),
          proposition: String(row.proposition || candidate.proposition),
          ratioOrRule: String(row.ratioOrRule || candidate.ratioOrRule),
          relevanceReason: String(row.relevanceReason || ''),
          confidence: Math.min(candidate.confidence, this.clamp(Number(row.confidence || candidate.confidence), 0, 100)),
        }, result.length));
      });
    }
    const covered = new Set(result.map((a) => a.issueId));
    for (const issue of issues) {
      if (covered.has(issue.id)) continue;
      result.push(...this.rankForIssue(issue, candidates, options).slice(0, 7).map((candidate) => this.toAuthority(candidate, issue.id, {}, result.length)));
    }
    return this.dedupe(result);
  }

  private deterministicRank(issues: IssueMatrixItem[], candidates: Candidate[], options: MemorialWorkflowOptions) {
    const result: ResearchAuthority[] = [];
    for (const issue of issues) {
      const ranked = this.rankForIssue(issue, candidates, options).slice(0, options.depth === 'exhaustive' ? 10 : options.depth === 'standard' ? 6 : 8);
      ranked.forEach((candidate) => result.push(this.toAuthority(candidate, issue.id, { relevanceReason: `Matched to ${issue.issue}` }, result.length)));
    }
    return this.dedupe(result);
  }

  private rankForIssue(issue: IssueMatrixItem, candidates: Candidate[], options: MemorialWorkflowOptions) {
    const queryTokens = this.tokens([issue.issue, ...issue.subIssues, ...issue.legalTests, ...issue.legalAnchors, ...issue.authorityQueries].join(' '));
    const family = this.issueFamily(issue.issue);
    return candidates
      .filter((candidate) => (candidate.verified || options.allowUnverifiedAuthorities) && this.isValidAuthorityCitation(candidate.citation))
      .map((candidate) => ({
        candidate,
        score: this.overlap(queryTokens, candidate.keywords)
          + this.familyCompatibility(family, candidate)
          + (candidate.verified ? 2 : 0)
          + candidate.confidence / 100,
      }))
      .filter((item) => item.score > 2.4)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.candidate);
  }

  private toAuthority(candidate: Candidate, issueId: string, overrides: Partial<ResearchAuthority> = {}, index = 0): ResearchAuthority {
    return {
      id: `AUTH_${index + 1}`,
      type: candidate.type,
      citation: candidate.citation,
      proposition: overrides.proposition || candidate.proposition,
      ratioOrRule: overrides.ratioOrRule || candidate.ratioOrRule,
      sideUsefulness: overrides.sideUsefulness || candidate.defaultSide,
      risk: candidate.risk,
      issueId,
      confidence: overrides.confidence || candidate.confidence,
      verified: candidate.verified,
      verificationSource: candidate.verificationSource,
      court: candidate.court,
      year: candidate.year,
      pinpoint: candidate.pinpoint,
      relevanceReason: overrides.relevanceReason || '',
      sourceUrl: candidate.sourceUrl,
    };
  }

  private dedupe(items: ResearchAuthority[]) {
    const seen = new Set<string>();
    const result = items.filter((item) => {
      const key = `${item.issueId}:${item.citation.toLowerCase().replace(/\s+/g, ' ')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    result.forEach((item, index) => { item.id = `AUTH_${index + 1}`; });
    return result;
  }


  private isValidAuthorityCitation(citation: string) {
    const clean = String(citation || '').replace(/\s+/g, ' ').trim();
    if (clean.length < 8 || clean.length > 190) return false;
    if (/accused|complainant|alleged|matrimonial|obtained|misused|violating|personal data obtained/i.test(clean)) return false;
    return /(?:\bv\.?\s+|\(\d{4}\)|AIR\s+\d{4}|SCC|SCR|Article\s+\d+|Section\s+\d+|Act,?\s+\d{4}|Adhiniyam,?\s+\d{4}|Sanhita,?\s+\d{4}|Constitution of India|Mutual Legal Assistance)/i.test(clean);
  }

  private issueFamily(issue: string) {
    if (/ELECTRONIC|EVIDENCE|SAKSHYA|CERTIFICATE|FORENSIC/i.test(issue)) return 'evidence';
    if (/JURISDICTION|FOREIGN|SERVER|INTERMEDIAR|EXTRATERRITORIAL/i.test(issue)) return 'jurisdiction';
    if (/SEARCH|SEIZURE|PRIVACY|ARTICLE 21|DEVICE|DATA MINIM/i.test(issue)) return 'privacy';
    if (/CONVICTION|SENTENCE|PUNISHMENT|PROPORTIONATE/i.test(issue)) return 'sentence';
    return 'general';
  }

  private familyCompatibility(family: string, candidate: Candidate) {
    const text = `${candidate.citation} ${candidate.proposition} ${candidate.ratioOrRule} ${candidate.keywords.join(' ')}`.toLowerCase();
    const tests: Record<string, RegExp> = {
      evidence: /electronic|evidence|certificate|sakshya|forensic|custody|authentic|computer output|mode of proof/,
      jurisdiction: /jurisdiction|extraterritorial|territorial nexus|section 75|foreign|server|article 245|comity|legal assistance/,
      privacy: /privacy|article 21|search|seizure|surveillance|data|minimisation|proportionality|due process/,
      sentence: /article 136|appeal|conviction|sentence|punishment|proportionality|concurrent findings|special leave|proof beyond/,
      general: /./,
    };
    return tests[family]?.test(text) ? 3 : -3;
  }

  private toCollection(source: string): RetrievalCollection | null {
    const normalized = source.toLowerCase();
    if (/judg|case|supreme|high court/.test(normalized)) return 'judgments';
    if (/act|statute|constitution|bare/.test(normalized)) return 'acts';
    if (/law commission|report/.test(normalized)) return 'law_commission_reports';
    if (/paper|journal|article/.test(normalized)) return 'research_papers';
    if (/uploaded|session|document/.test(normalized)) return 'user_documents';
    return null;
  }

  private side(value: any, fallback: ResearchAuthority['sideUsefulness']) { return ['petitioner', 'respondent', 'both'].includes(String(value)) ? String(value) as ResearchAuthority['sideUsefulness'] : fallback; }
  private isDuplicateCitation(items: Array<{ citation: string }>, citation: string) { const normalized = citation.toLowerCase().replace(/[^a-z0-9]+/g, ' '); return items.some((x) => x.citation.toLowerCase().replace(/[^a-z0-9]+/g, ' ') === normalized); }
  private tokens(text: string) { return Array.from(new Set(String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 3 && !['whether', 'court', 'india', 'indica', 'under', 'with', 'that', 'this', 'from'].includes(x)))); }
  private overlap(a: string[], b: string[]) { const set = new Set(b); return a.reduce((sum, token) => sum + (set.has(token) ? 1 : 0), 0); }
  private clamp(value: number, min: number, max: number) { return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min; }
}

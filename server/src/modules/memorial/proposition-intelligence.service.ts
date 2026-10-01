import { Injectable, Logger } from '@nestjs/common';
import {
  CaseDossier,
  DossierParagraph,
  DocumentSectionType,
  MemorialWorkflowOptions,
  PropositionBlueprint,
  PropositionFact,
} from './memorial.types';
import { MemorialAiService } from './memorial-ai.service';
import { MEMORIAL_SYSTEM, propositionPrompt } from './memorial-prompts';

@Injectable()
export class PropositionIntelligenceService {
  private readonly logger = new Logger(PropositionIntelligenceService.name);

  constructor(private readonly ai: MemorialAiService) {}

  async analyze(
    dossier: CaseDossier,
    options: MemorialWorkflowOptions,
  ): Promise<{ blueprint: PropositionBlueprint; usedAi: boolean; warning?: string }> {
    try {
      const chunks = this.buildSourceChunks(dossier, 32_000);
      const partials: any[] = [];
      for (let i = 0; i < chunks.length; i += 1) {
        partials.push(await this.ai.json<any>({
          system: MEMORIAL_SYSTEM,
          prompt: propositionPrompt(chunks[i], options.competitionRulesText || ''),
          options,
          maxTokens: 6500,
          stage: `proposition-intelligence-${i + 1}`,
        }));
      }
      const blueprint = this.normalize(this.mergePartials(partials), dossier, options);
      if (blueprint.facts.filter((fact) => fact.materiality === 'high').length < 4) {
        throw new Error('AI proposition extraction returned too few material facts after validation.');
      }
      return { blueprint, usedAi: true };
    } catch (error: any) {
      this.logger.warn(`Proposition intelligence fallback used: ${error?.message || error}`);
      return {
        blueprint: this.normalize({}, dossier, options),
        usedAi: false,
        warning: `AI proposition extraction was unavailable or unsafe; the deterministic source-grounded extractor was used: ${error?.message || error}`,
      };
    }
  }

  private buildSourceChunks(dossier: CaseDossier, maxChars: number) {
    const packets = dossier.paragraphs.map(
      (paragraph) => `[${paragraph.id}] [PAGE ${paragraph.pageNo}] [${paragraph.sectionType || paragraph.category}] ${paragraph.text}`,
    );
    const chunks: string[] = [];
    let current = '';
    for (const packet of packets) {
      if (current && current.length + packet.length + 2 > maxChars) {
        chunks.push(current);
        current = packet;
      } else {
        current = current ? `${current}\n\n${packet}` : packet;
      }
    }
    if (current) chunks.push(current);
    return chunks.length ? chunks : ['No extractable paragraphs.'];
  }

  private mergePartials(partials: any[]) {
    const merge = (key: string) => partials.flatMap((partial) => Array.isArray(partial?.[key]) ? partial[key] : []);
    const mergedRules: Record<string, any> = {};
    for (const partial of partials) {
      const rules = partial?.competitionRules || {};
      for (const [key, value] of Object.entries(rules)) {
        if (Array.isArray(value)) mergedRules[key] = Array.from(new Set([...(mergedRules[key] || []), ...value]));
        else if (!mergedRules[key] && value) mergedRules[key] = value;
      }
    }
    return {
      documentSections: merge('documentSections'),
      caseMetadata: partials.map((partial) => partial?.caseMetadata).find((item) => item && Object.values(item).some(Boolean)) || {},
      parties: merge('parties'),
      facts: merge('facts'),
      timeline: merge('timeline'),
      proceduralHistory: merge('proceduralHistory'),
      evidenceInventory: merge('evidenceInventory'),
      lawsMentioned: merge('lawsMentioned'),
      explicitIssues: merge('explicitIssues'),
      reliefs: merge('reliefs'),
      competitionRules: mergedRules,
      excludedContent: merge('excludedContent'),
      unresolvedQuestions: merge('unresolvedQuestions'),
    };
  }

  private normalize(raw: any, dossier: CaseDossier, options: MemorialWorkflowOptions): PropositionBlueprint {
    const paragraphById = new Map(dossier.paragraphs.map((paragraph) => [paragraph.id, paragraph]));
    const validSourceIds = new Set(paragraphById.keys());
    const normalizeSourceIds = (value: any) => Array.from(new Set((Array.isArray(value) ? value : [])
      .map((item) => String(item).trim())
      .filter((item) => validSourceIds.has(item))));

    const facts = this.buildFacts(raw?.facts, dossier, normalizeSourceIds, paragraphById);
    const factBySource = new Map<string, string[]>();
    for (const fact of facts) {
      for (const sourceId of fact.sourceIds) {
        factBySource.set(sourceId, [...(factBySource.get(sourceId) || []), fact.id]);
      }
    }
    const mapSourceToFacts = (sourceIds: any) => Array.from(new Set(normalizeSourceIds(sourceIds)
      .flatMap((sourceId) => factBySource.get(sourceId) || [])));

    const sections = this.dedupeSections((Array.isArray(raw?.documentSections) ? raw.documentSections : [])
      .map((section: any) => ({
        type: this.oneOf(section.type, [
          'cover_or_brochure', 'organiser_material', 'concept_note', 'competition_rules', 'moot_proposition',
          'procedural_history', 'issues', 'clarifications', 'annexure', 'unknown',
        ], 'unknown') as DocumentSectionType,
        pageStart: this.clamp(Number(section.pageStart || 1), 1, Math.max(1, dossier.pages.length)),
        pageEnd: this.clamp(Number(section.pageEnd || section.pageStart || 1), 1, Math.max(1, dossier.pages.length)),
        reason: String(section.reason || ''),
        confidence: this.clamp(Number(section.confidence || 65), 0, 100),
      })));

    const rawParties = (Array.isArray(raw?.parties) ? raw.parties : [])
      .map((party: any) => ({
        name: this.cleanName(String(party.name || '')),
        role: String(party.role || 'other'),
        description: this.cleanSentence(String(party.description || '')),
        sourceIds: normalizeSourceIds(party.sourceIds),
      }))
      .filter((party: any) => party.name && !this.isInstitutionalNoise(party.name));
    const parties = this.resolveParties(rawParties, dossier, facts);
    const caseMetadata = this.resolveCaseMetadata(raw?.caseMetadata || {}, dossier, facts, parties);

    const lawsMentioned = this.buildLawsMentioned(raw?.lawsMentioned, dossier, normalizeSourceIds);
    const explicitIssues = this.buildExplicitIssues(raw?.explicitIssues, dossier, normalizeSourceIds);

    const usedSourceIds = new Set(facts.flatMap((fact) => fact.sourceIds));
    const excludedRaw = Array.isArray(raw?.excludedContent) ? raw.excludedContent : [];
    const excludedContent = this.dedupeByKey([
      ...excludedRaw.map((entry: any) => ({
        sourceId: String(entry.sourceId || ''),
        reason: String(entry.reason || 'Non-case material'),
      })),
      ...dossier.paragraphs
        .filter((paragraph) => ['instruction', 'concept_note', 'organiser_material'].includes(paragraph.category) && !usedSourceIds.has(paragraph.id))
        .map((paragraph) => ({ sourceId: paragraph.id, reason: paragraph.category.replace(/_/g, ' ') })),
    ].filter((entry) => validSourceIds.has(entry.sourceId)), (entry) => entry.sourceId);

    const unresolvedIds = dossier.paragraphs
      .filter((paragraph) => !usedSourceIds.has(paragraph.id)
        && !excludedContent.some((entry) => entry.sourceId === paragraph.id)
        && paragraph.text.length > 30
        && !this.isNonCaseMaterial(paragraph.text))
      .map((paragraph) => paragraph.id);

    const competitionRules = raw?.competitionRules || {};
    const rulesCorpus = `${options.competitionRulesText || ''}\n${dossier.rawText}`;
    const total = dossier.paragraphs.length;
    const classified = total - unresolvedIds.length;

    return {
      documentSections: sections.length ? sections : this.sectionsFromDossier(dossier),
      caseMetadata,
      parties,
      facts,
      timeline: this.buildTimeline(raw?.timeline, dossier, facts, normalizeSourceIds, mapSourceToFacts),
      proceduralHistory: this.buildProceduralHistory(raw?.proceduralHistory, facts, normalizeSourceIds),
      evidenceInventory: this.buildEvidenceInventory(raw?.evidenceInventory, facts, normalizeSourceIds, mapSourceToFacts),
      lawsMentioned,
      explicitIssues,
      reliefs: this.dedupeByKey((Array.isArray(raw?.reliefs) ? raw.reliefs : [])
        .map((relief: any) => ({
          text: this.cleanSentence(String(relief.text || '')),
          side: this.oneOf(relief.side, ['petitioner', 'respondent', 'neutral'], 'neutral'),
          sourceIds: normalizeSourceIds(relief.sourceIds),
        }))
        .filter((relief: any) => relief.text && !this.isNonCaseMaterial(relief.text)),
      (relief) => `${relief.side}:${relief.text.toLowerCase()}`),
      competitionRules: {
        petitionerCoverColor: String(competitionRules.petitionerCoverColor || (/petitioner[^.]{0,80}blue|blue[^.]{0,80}petitioner/i.test(rulesCorpus) ? 'blue' : 'blue')),
        respondentCoverColor: String(competitionRules.respondentCoverColor || (/respondent[^.]{0,80}red|red[^.]{0,80}respondent/i.test(rulesCorpus) ? 'red' : 'red')),
        pageLimit: String(competitionRules.pageLimit || this.extractRuleValue(rulesCorpus, /(?:page limit|not exceed)\s*[:\-]?\s*([^\n.]{1,80})/i)),
        wordLimit: String(competitionRules.wordLimit || this.extractRuleValue(rulesCorpus, /(?:word limit|words?)\s*[:\-]?\s*([^\n.]{1,80})/i)),
        bodyFont: String(competitionRules.bodyFont || 'Times New Roman, 12 pt'),
        footnoteFont: String(competitionRules.footnoteFont || 'Times New Roman, 10 pt'),
        lineSpacing: String(competitionRules.lineSpacing || '1.5'),
        citationStyle: String(competitionRules.citationStyle || options.citationStyle || 'bluebook'),
        requiredSections: Array.from(new Set((Array.isArray(competitionRules.requiredSections) ? competitionRules.requiredSections : [])
          .map(String)
          .concat([
            'Cover Page', 'Table of Contents', 'Table of Abbreviations', 'Index of Authorities',
            'Statement of Jurisdiction', 'Statement of Facts', 'Issues for Consideration',
            'Summary of Arguments', 'Advance Arguments', 'Prayer',
          ]))),
        otherRules: Array.from(new Set((Array.isArray(competitionRules.otherRules) ? competitionRules.otherRules : []).map(String))),
      },
      excludedContent,
      unresolvedQuestions: Array.from(new Set([
        ...(Array.isArray(raw?.unresolvedQuestions) ? raw.unresolvedQuestions.map(String) : []),
        ...unresolvedIds.slice(0, 25).map((id) => `Unclassified source paragraph ${id}`),
      ])),
      coverage: {
        totalParagraphs: total,
        classifiedParagraphs: classified,
        usedAsCaseMaterial: usedSourceIds.size,
        excludedAsNonCaseMaterial: excludedContent.length,
        unresolved: unresolvedIds.length,
        coveragePercent: total ? Math.round((classified / total) * 100) : 0,
      },
    };
  }

  private buildFacts(
    rawFacts: any,
    dossier: CaseDossier,
    normalizeSourceIds: (value: any) => string[],
    paragraphById: Map<string, DossierParagraph>,
  ): PropositionFact[] {
    const candidates: PropositionFact[] = [];
    const pushCandidate = (candidate: Partial<PropositionFact>, fallbackSourceIds: string[] = []) => {
      const sourceIds = normalizeSourceIds(candidate.sourceIds || fallbackSourceIds);
      const exactQuote = String(candidate.exactQuote || sourceIds.map((id) => paragraphById.get(id)?.text || '').join(' ')).trim();
      const text = this.cleanSentence(String(candidate.text || exactQuote));
      if (!text || text.length < 24 || !sourceIds.length || this.isNonCaseMaterial(text) || !this.isCompleteCaseSentence(text)) return;
      candidates.push({
        id: '',
        text,
        exactQuote,
        sourceIds,
        kind: this.oneOf(candidate.kind, ['background', 'event', 'procedural', 'evidence', 'allegation', 'finding', 'relief', 'other'], this.inferFactKind(text)),
        status: this.oneOf(candidate.status, ['admitted', 'disputed', 'alleged', 'finding', 'unclear'], this.inferFactStatus(text)),
        materiality: this.oneOf(candidate.materiality, ['high', 'medium', 'low'], this.inferMateriality(text)),
        confidence: this.clamp(Number(candidate.confidence || 78), 0, 100),
      });
    };

    for (const rawFact of Array.isArray(rawFacts) ? rawFacts : []) {
      const sourceIds = normalizeSourceIds(rawFact?.sourceIds);
      const text = this.cleanSentence(String(rawFact?.text || rawFact?.exactQuote || ''));
      const pieces = this.splitSentences(text).filter((piece) => this.caseFactScore(piece.toLowerCase()) >= 1 || /trial court|high court|supreme court/i.test(piece));
      if (pieces.length > 1) {
        pieces.forEach((piece) => pushCandidate({ ...rawFact, text: piece, exactQuote: rawFact?.exactQuote }, sourceIds));
      } else {
        pushCandidate(rawFact, sourceIds);
      }
    }

    for (const paragraph of dossier.paragraphs) {
      if (!this.isPotentialCaseParagraph(paragraph)) continue;
      for (const sentence of this.splitSentences(paragraph.text)) {
        if (this.caseFactScore(sentence.toLowerCase()) < 1 && !/trial court|high court|supreme court|article 136|section 75/i.test(sentence)) continue;
        pushCandidate({
          text: sentence,
          exactQuote: sentence,
          sourceIds: [paragraph.id],
          kind: this.inferFactKind(sentence),
          status: this.inferFactStatus(sentence),
          materiality: this.inferMateriality(sentence),
          confidence: 84,
        }, [paragraph.id]);
      }
    }

    const deduped = this.dedupeByKey(candidates, (fact) => this.normalizedKey(fact.text));
    deduped.sort((a, b) => this.factSortScore(b) - this.factSortScore(a));
    const retained = deduped.slice(0, 60);
    retained.forEach((fact, index) => { fact.id = `F${index + 1}`; });
    return retained;
  }

  private resolveParties(rawParties: any[], dossier: CaseDossier, facts: PropositionFact[]) {
    const corpus = `${dossier.rawText}\n${facts.map((fact) => fact.text).join('\n')}`;
    const namedPeople = Array.from(new Set([
      ...(corpus.match(/\b(?:Mr\.|Ms\.|Mrs\.|Dr\.)\s+[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,2}/g) || []),
      ...(corpus.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+(?=,\s*aged\s+\d+)/g) || []),
    ].map((name) => this.cleanName(name))));

    const resolved = [...rawParties];
    for (const name of namedPeople) {
      if (resolved.some((party) => party.name.toLowerCase() === name.toLowerCase())) continue;
      const escaped = this.escapeRegex(name.replace(/^(Mr\.|Ms\.|Mrs\.|Dr\.)\s+/, ''));
      const role = new RegExp(`(?:accused|appellant|petitioner)[^.!?]{0,80}${escaped}|${escaped}[^.!?]{0,80}(?:accused|appellant|petitioner)`, 'i').test(corpus)
        ? 'accused'
        : new RegExp(`(?:complainant|victim)[^.!?]{0,80}${escaped}|${escaped}[^.!?]{0,80}(?:complainant|victim)`, 'i').test(corpus)
          ? 'complainant'
          : 'other';
      resolved.push({ name, role, description: '', sourceIds: [] });
    }

    const stateName = (corpus.match(/\b(?:Republic|State|Union) of (?:India|Indica|[A-Z][A-Za-z]+)\b/g) || [])
      .find((name) => !/Madho Pradesh/i.test(name));
    if (stateName && !resolved.some((party) => party.name.toLowerCase() === stateName.toLowerCase())) {
      resolved.push({ name: stateName, role: 'respondent', description: 'Prosecuting State', sourceIds: [] });
    }

    return this.dedupeByKey(resolved.filter((party) => party.name && !this.isInstitutionalNoise(party.name)),
      (party) => `${party.name.toLowerCase()}:${party.role}`);
  }

  private resolveCaseMetadata(rawMeta: any, dossier: CaseDossier, facts: PropositionFact[], parties: any[]) {
    const corpus = `${dossier.rawText}\n${facts.map((fact) => fact.text).join('\n')}`;
    const arbitration = /request for arbitration|arbitral tribunal|investor[- ]state arbitration|ICSID|investment dispute/i.test(corpus);
    const appellate = /high court[^.!?]{0,240}(?:upheld|affirmed)[^.!?]{0,160}(?:conviction|sentence)|aggrieved[^.!?]{0,180}(?:supreme court|special leave|article 136)/i.test(corpus);
    const directWrit = !arbitration && !appellate && /article\s+32|writ petition[^.!?]{0,120}supreme court/i.test(corpus);
    const country = (this.findFirst(corpus, /(?:Supreme Court|Republic|Union) of ([A-Z][A-Za-z]+)/i).match(/of\s+([A-Z][A-Za-z]+)/i)?.[1]
      || this.findFirst(corpus, /Constitution of ([A-Z][A-Za-z]+)/i).match(/of\s+([A-Z][A-Za-z]+)/i)?.[1]
      || 'INDIA').toUpperCase();
    const complainant = parties.find((party) => /complainant|victim/i.test(party.role));
    const expresslyAccused = parties.find((party) => /^(?:accused|appellant)$/i.test(String(party.role || '').trim())
      && !/state|republic|union|complainant|victim/i.test(party.name));
    const accusedNameFromText = this.findNamedRole(corpus, 'accused') || this.findNamedRole(corpus, 'appellant');
    const looserAppellant = parties.find((party) => /accused|appellant|petitioner/i.test(party.role)
      && !/state|republic|union|complainant|victim/i.test(party.name)
      && party.name.toLowerCase() !== String(complainant?.name || '').toLowerCase());
    const state = parties.find((party) => /state|prosecution|authority/i.test(party.role)
      || /state|republic|union/i.test(party.name));

    const petitionerName = arbitration
      ? (this.cleanName(String(rawMeta?.petitionerName || '')) || 'THE CLAIMANT')
      : appellate
      ? (accusedNameFromText || expresslyAccused?.name || looserAppellant?.name || 'THE APPELLANT')
      : (this.cleanName(String(rawMeta?.petitionerName || '')) || expresslyAccused?.name || looserAppellant?.name || complainant?.name || 'THE PETITIONER');
    const respondentName = appellate
      ? (state?.name || this.cleanName(String(rawMeta?.respondentName || '')) || `STATE OF ${country}`)
      : (this.cleanName(String(rawMeta?.respondentName || '')) || state?.name || `STATE OF ${country}`);

    const competitionName = this.cleanHeading(String(rawMeta?.competitionName || ''))
      || this.findFirst(corpus, /[A-Z][A-Z .&'-]{3,80}(?:INTERNATIONAL\s+)?MOOT COURT COMPETITION\s*\d{4}/i)
      || 'MOOT COURT COMPETITION';
    const caseNumberSource = this.findFirst(corpus, /(?:CRIMINAL|CIVIL|WRIT|SPECIAL LEAVE|SLP)\s+(?:APPEAL|PETITION)?\s*(?:NO\.?|NUMBER)\s*[^\n.]{0,45}/i);
    const caseNumber = this.sanitizeCaseNumber(String(rawMeta?.caseNumber || caseNumberSource || ''), appellate);
    const jurisdictionProvision = arbitration
      ? (this.cleanHeading(String(rawMeta?.jurisdictionProvision || rawMeta?.jurisdiction || '')) || 'THE APPLICABLE INVESTMENT AGREEMENT AND ARBITRATION RULES')
      : appellate
      ? `ARTICLE 136 OF THE CONSTITUTION OF ${country}`
      : directWrit
        ? `ARTICLE 32 OF THE CONSTITUTION OF ${country}`
        : this.cleanHeading(String(rawMeta?.jurisdictionProvision || rawMeta?.jurisdiction || ''));
    const jurisdiction = arbitration
      ? `ARBITRAL JURISDICTION UNDER ${jurisdictionProvision}`
      : appellate
      ? `APPELLATE JURISDICTION UNDER ${jurisdictionProvision}`
      : directWrit
        ? `WRIT JURISDICTION UNDER ${jurisdictionProvision}`
        : this.cleanHeading(String(rawMeta?.jurisdiction || 'APPROPRIATE JURISDICTION'));

    return {
      competitionName: competitionName.toUpperCase(),
      court: this.cleanHeading(String(rawMeta?.court || '')) || (arbitration ? 'BEFORE THE ARBITRAL TRIBUNAL' : `THE HON'BLE SUPREME COURT OF ${country}`),
      jurisdiction,
      jurisdictionProvision,
      caseNumber,
      proceduralStage: arbitration ? 'Investor-State arbitration proceedings' : appellate ? 'Criminal appellate proceedings before the Supreme Court' : String(rawMeta?.proceduralStage || ''),
      petitionerLabel: arbitration ? String(rawMeta?.petitionerLabel || 'CLAIMANT') : appellate ? 'PETITIONER / APPELLANT' : String(rawMeta?.petitionerLabel || 'PETITIONER'),
      respondentLabel: String(rawMeta?.respondentLabel || 'RESPONDENT'),
      petitionerName: petitionerName.toUpperCase(),
      respondentName: respondentName.toUpperCase(),
      teamCode: String(rawMeta?.teamCode || '').trim(),
    };
  }

  private buildLawsMentioned(rawLaws: any, dossier: CaseDossier, normalizeSourceIds: (value: any) => string[]) {
    const entries: Array<{ citation: string; context: string; sourceIds: string[] }> = [];
    const add = (citation: string, context: string, sourceIds: string[]) => {
      const clean = this.canonicalCitation(citation);
      if (!clean || !this.isValidLegalCitation(clean)) return;
      entries.push({ citation: clean, context: this.cleanSentence(context).slice(0, 700), sourceIds });
    };

    for (const rawLaw of Array.isArray(rawLaws) ? rawLaws : []) {
      const sourceIds = normalizeSourceIds(rawLaw?.sourceIds);
      for (const citation of this.extractLegalCitations(String(rawLaw?.citation || rawLaw?.context || ''))) {
        add(citation, String(rawLaw?.context || citation), sourceIds);
      }
    }
    for (const paragraph of dossier.paragraphs) {
      if (['organiser_material', 'cover_or_brochure', 'concept_note'].includes(paragraph.sectionType || '')) continue;
      for (const citation of this.extractLegalCitations(paragraph.text)) add(citation, paragraph.text, [paragraph.id]);
    }
    return this.dedupeByKey(entries, (entry) => entry.citation.toLowerCase());
  }

  private buildExplicitIssues(rawIssues: any, dossier: CaseDossier, normalizeSourceIds: (value: any) => string[]) {
    const issues: Array<{ text: string; sourceIds: string[] }> = [];
    for (const rawIssue of Array.isArray(rawIssues) ? rawIssues : []) {
      const sourceIds = normalizeSourceIds(rawIssue?.sourceIds);
      for (const text of this.splitIssues(String(rawIssue?.text || ''))) {
        const normalized = this.normalizeIssue(text);
        if (normalized.length > 35) issues.push({ text: normalized, sourceIds });
      }
    }
    for (const paragraph of dossier.paragraphs) {
      if (paragraph.category !== 'issue' && !/issues raised|issues for consideration|whether/i.test(paragraph.text)) continue;
      for (const text of this.splitIssues(paragraph.text)) {
        const normalized = this.normalizeIssue(text);
        if (normalized.length > 35) issues.push({ text: normalized, sourceIds: [paragraph.id] });
      }
    }
    return this.dedupeByKey(issues, (issue) => this.normalizedKey(issue.text)).slice(0, 6);
  }

  private buildTimeline(rawTimeline: any, dossier: CaseDossier, facts: PropositionFact[], normalizeSourceIds: (value: any) => string[], mapSourceToFacts: (value: any) => string[]) {
    const rows = (Array.isArray(rawTimeline) ? rawTimeline : []).map((entry: any) => {
      const sourceIds = normalizeSourceIds(entry.sourceIds);
      return { date: String(entry.date || ''), event: this.cleanSentence(String(entry.event || '')), sourceIds, factIds: mapSourceToFacts(sourceIds) };
    }).filter((entry: any) => entry.event && entry.sourceIds.length && !this.isNonCaseMaterial(entry.event));

    for (const fact of facts) {
      const dates = fact.text.match(/\b(?:\d{1,2}\s+[A-Z][a-z]+\s+\d{4}|[A-Z][a-z]+\s+\d{4}|\d{4})\b/g) || [];
      dates.forEach((date) => rows.push({ date, event: fact.text, sourceIds: fact.sourceIds, factIds: [fact.id] }));
    }
    return this.dedupeByKey(rows, (entry) => `${entry.date}:${this.normalizedKey(entry.event)}`);
  }

  private buildProceduralHistory(rawHistory: any, facts: PropositionFact[], normalizeSourceIds: (value: any) => string[]) {
    const rows = (Array.isArray(rawHistory) ? rawHistory : []).map((entry: any) => ({
      step: this.cleanSentence(String(entry.step || '')),
      courtOrAuthority: this.cleanHeading(String(entry.courtOrAuthority || '')),
      result: this.cleanSentence(String(entry.result || '')),
      sourceIds: normalizeSourceIds(entry.sourceIds),
    })).filter((entry: any) => entry.step && entry.sourceIds.length && !this.isNonCaseMaterial(entry.step));
    for (const fact of facts.filter((item) => item.kind === 'procedural' || item.kind === 'finding')) {
      rows.push({
        step: fact.text,
        courtOrAuthority: this.findFirst(fact.text, /(?:Trial Court|High Court[^,.]*|Supreme Court[^,.]*)/i),
        result: fact.text,
        sourceIds: fact.sourceIds,
      });
    }
    return this.dedupeByKey(rows, (entry) => this.normalizedKey(`${entry.step}:${entry.result}`)).slice(0, 12);
  }

  private buildEvidenceInventory(rawEvidence: any, facts: PropositionFact[], normalizeSourceIds: (value: any) => string[], mapSourceToFacts: (value: any) => string[]) {
    const entries = (Array.isArray(rawEvidence) ? rawEvidence : []).map((entry: any, index: number) => {
      const sourceIds = normalizeSourceIds(entry.sourceIds);
      return {
        id: `E${index + 1}`,
        item: this.cleanSentence(String(entry.item || '')),
        source: this.cleanSentence(String(entry.source || '')),
        collectionMethod: this.cleanSentence(String(entry.collectionMethod || '')),
        authenticityQuestion: this.cleanSentence(String(entry.authenticityQuestion || '')),
        chainOfCustodyQuestion: this.cleanSentence(String(entry.chainOfCustodyQuestion || '')),
        factIds: mapSourceToFacts(sourceIds),
      };
    }).filter((entry: any) => entry.item && !this.isNonCaseMaterial(entry.item));

    for (const fact of facts.filter((item) => item.kind === 'evidence')) {
      entries.push({
        id: '',
        item: fact.text,
        source: '',
        collectionMethod: /seized|warrant/i.test(fact.text) ? 'Search and seizure pursuant to the proposition record' : '',
        authenticityQuestion: /certificate|electronic|forensic|deleted|browser/i.test(fact.text) ? 'Whether source, authorship, integrity, and statutory authentication are established' : '',
        chainOfCustodyQuestion: /device|seized|forensic|electronic/i.test(fact.text) ? 'Whether continuity of custody and forensic integrity are proved' : '',
        factIds: [fact.id],
      });
    }
    const deduped = this.dedupeByKey(entries, (entry) => this.normalizedKey(entry.item)).slice(0, 24);
    deduped.forEach((entry, index) => { entry.id = `E${index + 1}`; });
    return deduped;
  }

  private isPotentialCaseParagraph(paragraph: DossierParagraph) {
    if (['instruction', 'concept_note', 'organiser_material'].includes(paragraph.category)) return false;
    if (['competition_rules', 'concept_note', 'organiser_material', 'cover_or_brochure'].includes(paragraph.sectionType || '')) return false;
    if (this.isNonCaseMaterial(paragraph.text)) return false;
    return ['fact', 'procedure', 'law', 'ambiguous', 'issue'].includes(paragraph.category)
      && (this.caseFactScore(paragraph.text.toLowerCase()) >= 1 || /trial court|high court|supreme court|appeal/i.test(paragraph.text));
  }

  private splitSentences(text: string) {
    return this.cleanSentence(text)
      .replace(/\s+(?=(?:The|In|On|Between|During|While|Beginning|Thereafter|Aggrieved|Pursuant|Forensic|Investigation|Ms\.|Mr\.)\s)/g, ' |SPLIT| ')
      .split(/\|SPLIT\||(?<=[.!?])\s+(?=[A-Z0-9“"'])/g)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 20);
  }

  private splitIssues(text: string) {
    const clean = this.cleanSentence(text)
      .replace(/^.*?(?:ISSUES RAISED|ISSUES FOR CONSIDERATION)\s*:?/i, '')
      .trim();
    const matches = clean.match(/Whether\s+[^?]+\?/gi);
    if (matches?.length) return matches;
    return clean.split(/(?=\bWhether\b)/i).map((item) => item.trim()).filter((item) => /^whether\b/i.test(item));
  }

  private extractLegalCitations(text: string) {
    const clean = this.cleanSentence(text);
    const patterns = [
      /Article\s+\d+(?:\([^)]+\))*\s*(?:,|of)?\s*(?:the\s+)?Constitution of [A-Z][A-Za-z]+/gi,
      /Article\s+\d+(?:\([^)]+\))*/gi,
      /Section\s+\d+[A-Za-z]?(?:\([^)]+\))*\s*(?:of\s+the|,)?\s*[A-Z][A-Za-z\s.]+(?:Act|Adhiniyam|Sanhita|Code),?\s*\d{4}/gi,
      /Article\s+\d+(?:\([^)]+\))*\s+of\s+(?:the\s+)?[A-Z][A-Za-z0-9 .,'’&()-]{3,120}(?:Treaty|Agreement|Convention|Rules|Regulations|Statute|Code)/gi,
      /[A-Z][A-Za-z0-9 .,'’&()-]{3,120}(?:Treaty|Agreement|Convention|Arbitration Rules|Investment Rules),?\s*(?:19|20)\d{2}/gi,
      /\b(?:The\s+)?[A-Z][A-Za-z-]*(?:\s+[A-Z][A-Za-z-]*){0,8}\s+(?:Act|Code|Rules|Regulations),?\s*(?:19|20)\d{2}\b/g,
      /[A-Z][A-Za-z0-9 .,'’&()-]{3,120}(?:Act|Code|Statute|Rules|Regulations),?\s*(?:19|20)\d{2}/gi,
      /Bharatiya Sakshya Adhiniyam,?\s*2023/gi,
      /Bharatiya Nyaya Sanhita,?\s*2023/gi,
      /Bharatiya Nagarik Suraksha Sanhita,?\s*2023/gi,
      /Information Technology Act,?\s*2000/gi,
      /Digital Personal Data Protection Act,?\s*2023/gi,
      /Constitution of [A-Z][A-Za-z]+/gi,
    ];
    return Array.from(new Set(patterns.flatMap((pattern) => clean.match(pattern) || []).map((citation) => this.canonicalCitation(citation))));
  }

  private canonicalCitation(citation: string) {
    return String(citation || '')
      .replace(/\s+/g, ' ')
      .replace(/\s+,/g, ',')
      .trim()
      .replace(/[.;:]+$/, '');
  }

  private isValidLegalCitation(citation: string) {
    if (citation.length < 8 || citation.length > 180) return false;
    if (/accused|complainant|alleged|matrimonial|obtained|misused|violat/i.test(citation)) return false;
    return /^(?:Article\s+\d+|Section\s+\d+|Bharatiya\s+|Information Technology Act|Digital Personal Data Protection Act|Constitution of [A-Z][A-Za-z]+|[A-Z].*(?:Treaty|Agreement|Convention|Rules|Regulations|Statute|Code))/i.test(citation);
  }

  private inferFactKind(text: string): PropositionFact['kind'] {
    if (/trial court|high court|supreme court|arbitral tribunal|arbitration|appeal|petition|suit|claimant|request for arbitration|convicted|sentence|judgment|interim direction|final hearing/i.test(text)) return 'procedural';
    if (/forensic|certificate|device|laptop|mobile|storage|browser|electronic evidence|seized|search and seizure/i.test(text)) return 'evidence';
    if (/alleged|asserted|maintained|contended|protested|claimed|prosecution alleges|complainant alleged|accused contended|disputed|challenged/i.test(text)) return 'allegation';
    if (/held|upheld|affirmed|convicted|found|ordered|directed|awarded/i.test(text)) return 'finding';
    return /aged|student|technician|republic|state|country|independence|constitutional|historical|colonial/i.test(text) ? 'background' : 'event';
  }

  private inferFactStatus(text: string): PropositionFact['status'] {
    if (/held|upheld|affirmed|convicted|found/i.test(text)) return 'finding';
    if (/alleged|claimed|contended|disputed|challenged|purported/i.test(text)) return 'disputed';
    if (/prosecution|complainant/i.test(text)) return 'alleged';
    return 'unclear';
  }

  private inferMateriality(text: string): PropositionFact['materiality'] {
    return /complainant|accused|claimant|respondent|petitioner|threat|fake|morphed|obscene|foreign|server|section 75|certificate|forensic|search|seizure|warrant|trial court|high court|supreme court|arbitral tribunal|convict|sentence|appeal|original jurisdiction|boundary|demarcat|territorial|river water|water dispute|treaty|agreement|contract|termination|expropriat|investment|article\s+\d+|section\s+\d+/i.test(text)
      ? 'high'
      : /email|social media|phone|data|privacy|device|intermediary|notification|project|licen[cs]e|permit|parliament|government|authority/i.test(text) ? 'medium' : 'low';
  }

  private factSortScore(fact: PropositionFact) {
    const materiality = fact.materiality === 'high' ? 50 : fact.materiality === 'medium' ? 25 : 0;
    const kind = ({ background: 6, event: 12, allegation: 14, evidence: 18, procedural: 20, finding: 20, relief: 0, other: 2 } as Record<string, number>)[fact.kind] || 0;
    return materiality + kind + fact.confidence / 10;
  }

  private isCompleteCaseSentence(text: string) {
    if (/\b(?:Mr|Ms|Mrs|Dr)\.?$/i.test(text)) return false;
    if (/^(?:Whether|ISSUE\b|All laws pari materia)/i.test(text)) return false;
    if (/ISSUES? (?:RAISED|FOR CONSIDERATION)|\bWhether\b[^?]{10,}\bWhether\b/i.test(text)) return false;
    if (text.split(/\s+/).length < 6) return false;
    return true;
  }

  private isNonCaseMaterial(text: string) {
    return /participants are invited|aims? to foster|moot problem aims|proposition is situated|explores issues relating|critical thinking|advocacy skills|team shall|each team|speaker|researcher|memorials? are required|blue cover|red cover|organis(?:ing|ing) committee|lawctopus|resolvify|patron|co-patron|convener|registration|award|submission deadline|page limit|font|rating of|collaborator|media partner|naac accredited|phone no|mobile no|email\s*:|address\s*:|preliminary rounds|quarter final|semi final|language of the competition/i.test(text);
  }

  private isInstitutionalNoise(text: string) {
    return /academy|law school|committee|lawctopus|resolvify|partner|university$|college$/i.test(text);
  }

  private caseFactScore(text: string) {
    return (text.match(/accused|complainant|victim|petitioner|appellant|claimant|respondent|state|republic|union|government|authority|company|corporation|lodged|filed|admitted|issued|enacted|notified|entered|terminated|cancelled|warrant|forensic|seized|search|trial court|high court|supreme court|arbitral tribunal|arbitration|convicted|appeal|suit|alleged|asserted|contended|maintained|protested|challenged|disputed|discovered|received|created|circulated|registered|investigation|morphed|fake account|threat|harassment|server|device|laptop|mobile|certificate|matrimonial|email|social media|boundary|border|corridor|demarcat|territorial|river|water project|tribunal|treaty|agreement|contract|investment|expropriat|parliament|constitution|article\s+\d+|section\s+\d+/g) || []).length;
  }

  private findNamedRole(corpus: string, role: string) {
    const roleBefore = new RegExp(`${role}[^.!?]{0,70}(?:Mr\\.|Ms\\.|Mrs\\.)?\\s*([A-Z][a-z]+\\s+[A-Z][a-z]+)`, 'i').exec(corpus);
    if (roleBefore?.[1]) return roleBefore[1];
    const nameBefore = new RegExp(`(?:Mr\\.|Ms\\.|Mrs\\.)?\\s*([A-Z][a-z]+\\s+[A-Z][a-z]+)[^.!?]{0,70}${role}`, 'i').exec(corpus);
    return nameBefore?.[1] || '';
  }

  private sanitizeCaseNumber(value: string, appellate: boolean) {
    const clean = this.cleanHeading(value).replace(/(?:upheld|holding|sentence).*$/i, '').trim();
    const hasActualNumber = /(?:NO\.?|NUMBER)\s*(?:\d+|_+)/i.test(clean);
    const missingNumber = /(?:NO\.?|NUMBER)\s*(?:OF\s+\d{4}|$)/i.test(clean);
    if (clean && clean.length < 100 && /(?:appeal|petition|slp)/i.test(clean) && hasActualNumber && !missingNumber) return clean.toUpperCase();
    return appellate ? 'CRIMINAL APPEAL NO. ____ OF ____' : '';
  }

  private sectionsFromDossier(dossier: CaseDossier) {
    const groups: PropositionBlueprint['documentSections'] = [];
    for (const page of dossier.pages) {
      const type = page.sectionType || 'unknown';
      const last = groups[groups.length - 1];
      if (last && last.type === type && last.pageEnd === page.pageNo - 1) last.pageEnd = page.pageNo;
      else groups.push({ type, pageStart: page.pageNo, pageEnd: page.pageNo, reason: 'Deterministic page classification', confidence: page.sectionConfidence || 50 });
    }
    return groups;
  }

  private dedupeSections(items: PropositionBlueprint['documentSections']) {
    return this.dedupeByKey(items.map((item) => ({
      ...item,
      pageStart: Math.min(item.pageStart, item.pageEnd),
      pageEnd: Math.max(item.pageStart, item.pageEnd),
    })), (item) => `${item.type}:${item.pageStart}:${item.pageEnd}`);
  }

  private normalizedKey(text: string) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 260);
  }

  private normalizeIssue(text: string) {
    const clean = this.cleanSentence(text)
      .replace(/^\s*(?:ISSUE\s+[IVX0-9]+\s*[:.-]?\s*)/i, '')
      .replace(/^whether\s+/i, 'WHETHER ')
      .replace(/\?+$/, '')
      .trim();
    return clean ? `${clean}?`.toUpperCase() : '';
  }

  private cleanSentence(text: string) {
    return String(text || '')
      .replace(/\r/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/([a-z0-9])\.([A-Z])/g, '$1. $2')
      .replace(/\bd\s+espite\b/gi, 'despite')
      .trim();
  }

  private cleanHeading(text: string) {
    return this.cleanSentence(text).replace(/[.;:]+$/, '').trim();
  }

  private cleanName(text: string) {
    return this.cleanHeading(text).replace(/\s+(?:\.\.\.)?(?:PETITIONER|RESPONDENT|ACCUSED|COMPLAINANT)$/i, '').trim();
  }

  private extractRuleValue(text: string, regex: RegExp) {
    return (text.match(regex) || [])[1] || '';
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private oneOf<T extends string>(value: any, allowed: T[], fallback: T): T {
    return allowed.includes(String(value) as T) ? String(value) as T : fallback;
  }

  private clamp(value: number, min: number, max: number) {
    return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
  }

  private findFirst(text: string, regex: RegExp) {
    return (text.match(regex) || [])[0] || '';
  }

  private dedupeByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = keyFn(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

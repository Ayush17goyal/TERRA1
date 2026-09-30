import { Injectable, Logger } from '@nestjs/common';
import { CaseGraph, IssueMatrixItem, MemorialWorkflowOptions, PropositionBlueprint } from './memorial.types';
import { MemorialAiService } from './memorial-ai.service';
import { issuePrompt, MEMORIAL_SYSTEM } from './memorial-prompts';

@Injectable()
export class IssueEngineService {
  private readonly logger = new Logger(IssueEngineService.name);

  constructor(private readonly ai: MemorialAiService) {}

  async generate(graph: CaseGraph, blueprint: PropositionBlueprint, options: MemorialWorkflowOptions): Promise<{ issues: IssueMatrixItem[]; usedAi: boolean; warning?: string }> {
    const totalWordBudget = this.totalWordBudget(options, blueprint.explicitIssues.length || 4);
    try {
      const payload = this.compactBlueprint(blueprint, graph);
      const response = await this.ai.json<any>({
        system: MEMORIAL_SYSTEM,
        prompt: issuePrompt(JSON.stringify(payload), options.depth || 'deep', totalWordBudget),
        options,
        maxTokens: 4500,
        stage: 'issue-architecture',
      });
      const issues = this.normalize(response?.issues, graph, blueprint, totalWordBudget);
      if (issues.length < 2) throw new Error('Issue engine returned fewer than two usable issues.');
      return { issues, usedAi: true };
    } catch (error: any) {
      this.logger.warn(`Issue engine fallback used: ${error?.message || error}`);
      return {
        issues: this.fallback(graph, blueprint, totalWordBudget),
        usedAi: false,
        warning: `AI issue architecture unavailable; deterministic issue architecture used: ${error?.message || error}`,
      };
    }
  }

  private compactBlueprint(blueprint: PropositionBlueprint, graph: CaseGraph) {
    return {
      caseMetadata: blueprint.caseMetadata,
      parties: blueprint.parties,
      facts: blueprint.facts.map((f) => ({ id: f.id, text: f.text, kind: f.kind, status: f.status, materiality: f.materiality })),
      proceduralHistory: blueprint.proceduralHistory,
      evidenceInventory: blueprint.evidenceInventory,
      lawsMentioned: blueprint.lawsMentioned,
      explicitIssues: blueprint.explicitIssues,
      reliefs: blueprint.reliefs,
      burdens: graph.burdens,
    };
  }

  private normalize(rawIssues: any, graph: CaseGraph, blueprint: PropositionBlueprint, totalBudget: number): IssueMatrixItem[] {
    const supplied = Array.isArray(rawIssues) ? rawIssues : [];
    const exactIssues = blueprint.explicitIssues.map((x) => this.normalizeIssue(x.text));
    const factIds = new Set(graph.facts.map((f) => f.id));
    const result = supplied.slice(0, 6).map((raw: any, index: number) => {
      const issue = exactIssues[index] || this.normalizeIssue(raw.issue || '');
      const selectedFactIds: string[] = Array.from(new Set<string>((Array.isArray(raw.factIds) ? raw.factIds : []).map((value: any) => String(value)).filter((id: string) => factIds.has(id))));
      const target = Number(raw.targetWordCount || 0);
      const fallback = this.fallbackIssue(issue, index, graph, Math.max(900, Math.round(totalBudget / Math.max(1, supplied.length || exactIssues.length || 1))));
      const rawSubIssues = this.cleanArray(raw.subIssues, 3, 6);
      const rawTests = this.cleanArray(raw.legalTests, 2, 10);
      const compatibleSubIssues = this.isCompatibleStructure(issue, rawSubIssues) ? rawSubIssues : fallback.subIssues;
      const compatibleTests = this.isCompatibleStructure(issue, rawTests) ? rawTests : fallback.legalTests;
      const factSelection = selectedFactIds.length >= 2 ? selectedFactIds : fallback.factIds;
      return {
        id: `ISSUE_${index + 1}`,
        issue,
        petitionerPosition: this.cleanPosition(raw.petitionerPosition, 'petitioner', issue) || fallback.petitionerPosition,
        respondentPosition: this.cleanPosition(raw.respondentPosition, 'respondent', issue) || fallback.respondentPosition,
        subIssues: compatibleSubIssues,
        legalTests: compatibleTests,
        factualAnchors: factSelection.map((id) => graph.facts.find((f) => f.id === id)?.text || '').filter(Boolean),
        factIds: factSelection,
        legalAnchors: this.cleanArray(raw.legalAnchors, 1, 10).length ? this.cleanArray(raw.legalAnchors, 1, 10) : fallback.legalAnchors,
        authorityQueries: this.cleanArray(raw.authorityQueries, 2, 8).length ? this.cleanArray(raw.authorityQueries, 2, 8) : fallback.authorityQueries,
        burden: String(raw.burden || fallback.burden),
        reliefConsequence: String(raw.reliefConsequence || fallback.reliefConsequence),
        targetWordCount: target > 500 ? Math.round(target) : fallback.targetWordCount,
      };
    }).filter((x: IssueMatrixItem) => x.issue.length > 35);

    if (exactIssues.length && result.length < exactIssues.length) {
      const existing = new Set(result.map((x) => x.issue));
      for (const issue of exactIssues) {
        if (existing.has(issue)) continue;
        result.push(this.fallbackIssue(issue, result.length, graph, totalBudget / exactIssues.length));
      }
    }
    return this.dedupe(result).slice(0, 6);
  }

  private fallback(graph: CaseGraph, blueprint: PropositionBlueprint, totalBudget: number) {
    const explicit = blueprint.explicitIssues.map((i) => this.normalizeIssue(i.text));
    const inferred = [
      /electronic|evidence|certificate|sakshya|forensic/i.test(this.corpus(blueprint)) ? 'WHETHER THE ELECTRONIC EVIDENCE RELIED UPON IS ADMISSIBLE IN ACCORDANCE WITH THE APPLICABLE EVIDENTIARY SAFEGUARDS?' : '',
      /section 75|foreign|server|intermediary|extraterritorial|jurisdiction/i.test(this.corpus(blueprint)) ? 'WHETHER THE COURT HAS JURISDICTION OVER THE ALLEGED CROSS-BORDER CYBER CONDUCT AND FOREIGN-HOSTED MATERIAL?' : '',
      /search|seizure|device|privacy|article 21|data minimisation/i.test(this.corpus(blueprint)) ? 'WHETHER THE SEARCH, SEIZURE, AND FORENSIC EXAMINATION OF DIGITAL DEVICES COMPLIED WITH ARTICLE 21 AND DUE PROCESS?' : '',
      /conviction|sentence|punishment|proportionate/i.test(this.corpus(blueprint)) ? 'WHETHER THE IMPUGNED CONVICTION AND SENTENCE ARE LEGALLY SUSTAINABLE AND PROPORTIONATE?' : '',
    ].filter(Boolean).map((x) => this.normalizeIssue(x));
    const issues = (explicit.length ? explicit : inferred).slice(0, 6);
    return issues.map((issue, index) => this.fallbackIssue(issue, index, graph, totalBudget / Math.max(1, issues.length)));
  }

  private fallbackIssue(issue: string, index: number, graph: CaseGraph, target: number): IssueMatrixItem {
    const facts = this.pickFacts(issue, graph.facts);
    const isEvidence = /ELECTRONIC|EVIDENCE|SAKSHYA|FORENSIC/i.test(issue);
    const isJurisdiction = /JURISDICTION|FOREIGN|SERVER|INTERMEDIAR|EXTRATERRITORIAL/i.test(issue);
    const isPrivacy = /SEARCH|SEIZURE|PRIVACY|ARTICLE 21|DEVICE/i.test(issue);
    const isSentence = /CONVICTION|SENTENCE|PROPORTIONATE|PUNISHMENT/i.test(issue);
    return {
      id: `ISSUE_${index + 1}`,
      issue,
      petitionerPosition: isEvidence
        ? 'The Petitioners submit that the prosecution cannot rely on the electronic record unless every mandatory requirement governing authentication, source integrity, chain of custody, and forensic reliability is satisfied.'
        : isJurisdiction
          ? 'The Petitioners submit that cross-border internet use does not by itself create unlimited jurisdiction; the statutory nexus, territorial connection, and lawful acquisition of foreign material must each be established.'
          : isPrivacy
            ? 'The Petitioners submit that digital search and forensic examination violate Article 21 when they exceed lawful scope or lack necessity, proportionality, minimisation, and auditable safeguards.'
            : isSentence
              ? 'The Petitioners submit that a conviction or sentence founded on evidentiary, jurisdictional, or procedural error cannot be sustained and must independently satisfy proportionality.'
              : 'The Petitioners submit that the impugned action is legally unsustainable and warrants relief.',
      respondentPosition: isEvidence
        ? 'The Respondents submit that the electronic record is admissible because the statutory certificate, seizure record, forensic recovery, and surrounding circumstances cumulatively establish source, integrity, and reliability.'
        : isJurisdiction
          ? 'The Respondents submit that jurisdiction is established by the domestic accused, victim, harmful effects, investigation, and statutory nexus, notwithstanding the use of foreign infrastructure.'
          : isPrivacy
            ? 'The Respondents submit that the warrant-backed search and forensic examination were lawful, necessary, proportionate, and accompanied by safeguards appropriate to serious cybercrime.'
            : isSentence
              ? 'The Respondents submit that the concurrent findings and sentence are legally sustainable, supported by reliable evidence, and proportionate to the proved conduct and harm.'
              : 'The Respondents submit that the impugned action is lawful, proportionate, and should be upheld.',
      subIssues: isEvidence ? ['Statutory authentication', 'Source and authorship', 'Chain of custody and forensic integrity', 'Effect of any defect or prejudice']
        : isJurisdiction ? ['Statutory nexus', 'Territorial connection and effects', 'Foreign intermediaries and comity', 'Lawful acquisition and enforceability']
          : isPrivacy ? ['Legality and warrant scope', 'Necessity', 'Proportionality and minimisation', 'Auditability and procedural safeguards']
            : isSentence ? ['Standard of appellate interference', 'Proof beyond reasonable doubt', 'Effect of foundational defects', 'Proportionality of sentence']
              : ['Governing rule', 'Application', 'Counterargument', 'Relief'],
      legalTests: isEvidence ? ['statutory certificate compliance', 'authenticity', 'integrity', 'chain of custody', 'prejudice']
        : isJurisdiction ? ['statutory computer-system nexus', 'real territorial connection', 'effects', 'comity', 'lawful cross-border process']
          : isPrivacy ? ['legality', 'legitimate aim', 'necessity', 'proportionality', 'scope limitation', 'procedural safeguards']
            : isSentence ? ['substantial legal error', 'reliability of evidence', 'proved ingredients', 'individualised proportionality']
              : ['rule', 'application', 'relief'],
      factualAnchors: facts.map((f) => f.text),
      factIds: facts.map((f) => f.id),
      legalAnchors: this.anchorsFor(issue),
      authorityQueries: this.queriesFor(issue),
      burden: graph.burdens.find((b) => this.relevantBurden(issue, b)) || graph.burdens[index % graph.burdens.length] || graph.burdens[0],
      reliefConsequence: isSentence ? 'A finding for the Petitioners may require setting aside or modifying the conviction or sentence; a finding for the Respondents supports dismissal of the appeal.' : 'The finding determines whether the challenged evidence, jurisdiction, or procedure may support the final order.',
      targetWordCount: Math.max(900, Math.round(target)),
    };
  }

  private pickFacts(issue: string, facts: CaseGraph['facts']) {
    const regex = /ELECTRONIC|EVIDENCE|SAKSHYA|FORENSIC/i.test(issue) ? /evidence|certificate|forensic|device|deleted|browser|account|seiz|record/i
      : /JURISDICTION|FOREIGN|SERVER|INTERMEDIAR|EXTRATERRITORIAL/i.test(issue) ? /foreign|server|intermediary|jurisdiction|territor|victim|harm|service provider/i
      : /SEARCH|SEIZURE|PRIVACY|ARTICLE 21|DEVICE/i.test(issue) ? /search|seizure|device|privacy|data|minimis|warrant|forensic|personal/i
      : /CONVICTION|SENTENCE|PROPORTIONATE|PUNISHMENT/i.test(issue) ? /convict|sentence|high court|trial court|appeal|punish|harm|finding/i
      : /./;
    const primary = facts.filter((f) => regex.test(f.text));
    return [...primary, ...facts.filter((f) => f.materiality === 'high' && !primary.includes(f))].slice(0, 12);
  }


  private isCompatibleStructure(issue: string, items: string[]) {
    if (items.length < 3) return false;
    const joined = items.join(' ').toLowerCase();
    if (/ELECTRONIC|EVIDENCE|SAKSHYA|CERTIFICATE|FORENSIC/i.test(issue)) return /certificate|authentic|source|custody|forensic|prejudice/.test(joined);
    if (/JURISDICTION|FOREIGN|SERVER|INTERMEDIAR|EXTRATERRITORIAL/i.test(issue)) return /jurisdiction|nexus|territor|foreign|comity|assistance|enforce/.test(joined);
    if (/SEARCH|SEIZURE|PRIVACY|ARTICLE 21|DEVICE|DATA MINIM/i.test(issue)) return /legality|warrant|necessity|proportion|privacy|minimis|scope|audit|safeguard/.test(joined) && !/certificate|source and authorship|chain of custody/.test(joined);
    if (/CONVICTION|SENTENCE|PUNISHMENT|PROPORTIONATE/i.test(issue)) return /appeal|proof|conviction|sentence|punish|proportion|mitigat|aggravat/.test(joined);
    return true;
  }

  private totalWordBudget(options: MemorialWorkflowOptions, issueCount: number) {
    if (options.maxWords) return options.maxWords;
    const base = options.depth === 'standard' ? 3200 : options.depth === 'exhaustive' ? 7800 : 5600;
    return Math.max(base, issueCount * (options.depth === 'exhaustive' ? 1700 : options.depth === 'standard' ? 850 : 1250));
  }

  private compactIssueFactIds(value: string[]) { return Array.from(new Set(value)); }
  private cleanArray(value: any, min: number, max: number) { const list = (Array.isArray(value) ? value : []).map((x) => String(x).replace(/\s+/g, ' ').trim()).filter(Boolean); return Array.from(new Set(list)).slice(0, max).concat(list.length < min ? [] : []); }
  private cleanPosition(value: any, side: string, issue: string) { const clean = String(value || '').replace(/^the\s+(petitioners|respondents)\s+should argue that\s+/i, '').replace(/^should argue that\s+/i, '').trim(); return clean || `${side === 'petitioner' ? 'The Petitioners' : 'The Respondents'} submit that ${issue.toLowerCase()}`; }
  private normalizeIssue(issue: string) { const clean = String(issue || '').replace(/\s+/g, ' ').replace(/^WHETHER\s+whether\s+/i, 'WHETHER ').replace(/^whether\s+/i, 'WHETHER ').replace(/\?+$/, '').trim(); return clean ? `${clean}?`.toUpperCase() : ''; }
  private dedupe(items: IssueMatrixItem[]) { const seen = new Set<string>(); return items.filter((item) => { const key = item.issue.toLowerCase().replace(/[^a-z0-9]+/g, ' ').slice(0, 180); if (seen.has(key)) return false; seen.add(key); return true; }); }
  private corpus(blueprint: PropositionBlueprint) { return [...blueprint.explicitIssues.map((x) => x.text), ...blueprint.facts.map((x) => x.text), ...blueprint.lawsMentioned.map((x) => x.citation)].join(' '); }
  private relevantBurden(issue: string, burden: string) { const tokens = issue.toLowerCase().split(/\W+/).filter((x) => x.length > 6); return tokens.some((t) => burden.toLowerCase().includes(t)); }
  private anchorsFor(issue: string) { if (/EVIDENCE|SAKSHYA/i.test(issue)) return ['Bharatiya Sakshya Adhiniyam, 2023', 'electronic-record authentication']; if (/JURISDICTION|FOREIGN|SERVER/i.test(issue)) return ['Section 75, Information Technology Act, 2000', 'territorial nexus']; if (/PRIVACY|SEARCH|SEIZURE|ARTICLE 21/i.test(issue)) return ['Article 21, Constitution of India', 'privacy and due process']; if (/CONVICTION|SENTENCE/i.test(issue)) return ['Article 136, Constitution of India', 'criminal appellate review', 'proportionality']; return []; }
  private queriesFor(issue: string) { if (/EVIDENCE|SAKSHYA/i.test(issue)) return ['Supreme Court electronic evidence certificate Section 63 BSA chain of custody forensic extraction', 'electronic record authorship deleted data admissibility India']; if (/JURISDICTION|FOREIGN|SERVER/i.test(issue)) return ['Supreme Court Section 75 IT Act extraterritorial jurisdiction foreign server territorial nexus', 'cross-border cybercrime jurisdiction Indian courts foreign intermediary']; if (/PRIVACY|SEARCH|SEIZURE|ARTICLE 21/i.test(issue)) return ['Supreme Court digital device search privacy Article 21 proportionality warrant scope', 'forensic examination device data minimisation due process India']; if (/CONVICTION|SENTENCE/i.test(issue)) return ['Supreme Court Article 136 concurrent criminal findings electronic evidence sentence proportionality', 'criminal sentence proportionality cyber offence India']; return [issue]; }
}

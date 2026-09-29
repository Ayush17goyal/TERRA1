import { BadGatewayException, BadRequestException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { OpenRouterAiProviderService } from '../chat/openrouter-ai-provider.service';
import { AuthorityVerificationEngine } from '../chat/lexmentor/authority-verification-engine.service';
import { CitationGenerator } from '../chat/lexmentor/citation-generator.service';
import { SemanticCacheService } from '../chat/semantic-cache.service';
import { QdrantService } from '../retrieval/qdrant.service';
import { BgeM3Provider } from '../retrieval/bge-m3.provider';
import { LegalRetrievalService } from '../retrieval/legal-retrieval.service';
import { ParsedProvisionEntity } from '../ingestion/entities/parsed-provision.entity';
import {
  DraftingAcademyCheck,
  DraftingAcademyCourse,
  LegalAuthorityVerification,
  LegalResearchGuideSession,
  CaseSimulationSession,
  ResearchMentorSession,
} from './legal-intelligence.entities';

function tryParseJson<T>(value: string, fallback: T): T {
  try {
    const cleaned = value.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return fallback;
  }
}

export function cleanString(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .replace(/\u00e2\u0080\u0094/g, '\u2014')
    .replace(/\u00e2\u0080\u0093/g, '\u2013')
    .replace(/\u00e2\u0080\u0099/g, '\u2019')
    .replace(/\u00e2\u0080\u009c/g, '\u201c')
    .replace(/\u00e2\u0080\u009d/g, '\u201d')
    .replace(/\u00e2\u0080\u00a2/g, '\u2022')
    .replace(/\u00e2\u0080\u00a6/g, '\u2026')
    .replace(/\u00e2\u0080\u0098/g, '\u2018')
    .replace(/\u00e2\u0094\u0080/g, '\u2500')
    .replace(/\u00e2\u20ac\u201d/g, '\u2014')
    .replace(/\u00e2\u20ac\u201c/g, '\u2013')
    .replace(/\u00e2\u20ac\u2122/g, '\u2019')
    .replace(/\u00e2\u20ac\u0153/g, '\u201c')
    .replace(/\u00e2\u20ac\u009d/g, '\u201d')
    .replace(/\u00e2\u20ac\u00a2/g, '\u2022')
    .replace(/\u00e2\u20ac\u00a6/g, '\u2026')
    .replace(/\u00e2\u20ac\u02dc/g, '\u2018')
    .replace(/\u00e2\u201d\u20ac/g, '\u2500')
    .replace(/\u00e2\u20ac/g, '\u201d')
    .replace(/[\u0080-\u009f]/g, '');
}

export function cleanListItem(str: string | undefined | null): string {
  if (!str) return '';
  const temp = cleanString(str);
  return temp.replace(/^[\s\-\u2014\u2013\u2022*]+/, '').trim();
}

@Injectable()
export class LegalIntelligenceService {
  private readonly logger = new Logger(LegalIntelligenceService.name);

  constructor(
    @InjectRepository(LegalAuthorityVerification)
    private readonly verificationRepo: Repository<LegalAuthorityVerification>,
    @InjectRepository(LegalResearchGuideSession)
    private readonly guideRepo: Repository<LegalResearchGuideSession>,
    @InjectRepository(DraftingAcademyCourse)
    private readonly courseRepo: Repository<DraftingAcademyCourse>,
    @InjectRepository(DraftingAcademyCheck)
    private readonly draftCheckRepo: Repository<DraftingAcademyCheck>,
    @InjectRepository(CaseSimulationSession)
    private readonly sessionRepo: Repository<CaseSimulationSession>,
    @InjectRepository(ResearchMentorSession)
    private readonly mentorSessionRepo: Repository<ResearchMentorSession>,
    private readonly ai: OpenRouterAiProviderService,
    private readonly cache: SemanticCacheService,
    private readonly qdrantService: QdrantService,
    private readonly bgeM3Provider: BgeM3Provider,
    private readonly authorityVerificationEngine: AuthorityVerificationEngine,
    private readonly citationGenerator: CitationGenerator,
    @InjectRepository(ParsedProvisionEntity)
    private readonly parsedProvisionRepository: Repository<ParsedProvisionEntity>,
    private readonly legalRetrievalService: LegalRetrievalService,
  ) {}

  async verifyAuthority(userId: string, body: { query?: string; answer?: string; citations?: any[]; retrievedAuthorities?: any[]; verification?: any }) {
    const query = String(body.query || '').trim();
    const answer = String(body.answer || '').trim();

    if (body.verification && body.verification.available) {
      const saved = this.verificationRepo.create({ userId, query, answer, result: body.verification });
      await this.verificationRepo.save(saved);
      return body.verification;
    }

    const retrievedAuthorities = Array.isArray(body.retrievedAuthorities) ? body.retrievedAuthorities : [];
    if (!retrievedAuthorities.length) {
      return {
        available: false,
        authorityStatus: 'Unavailable',
        professionalSummary: 'Authority verification is unavailable because no retrieved legal evidence was supplied to the verification engine.',
        unsupportedReasoning: ['No retrieved authorities were available for verification.'],
        verificationTimestamp: new Date().toISOString(),
      };
    }

    const citations = this.citationGenerator.extract(retrievedAuthorities, answer);
    const result = this.authorityVerificationEngine.verify(retrievedAuthorities, citations, answer);
    await this.cache.set('research', `authority:${query}\n${answer}\n${retrievedAuthorities.map((item) => item.id).join('|')}`, result, { feature: 'authority-verification' });
    const saved = this.verificationRepo.create({ userId, query, answer, result });
    await this.verificationRepo.save(saved);
    return result;
  }
  async createResearchGuide(userId: string, proposition: string) {
    const clean = String(proposition || '').trim();
    const cacheKey = `research-guide:${clean}`;
    const cached = await this.cache.get('research', cacheKey, userId);
    if (cached) return { ...cached, cached: true };

    const fallback = this.localResearchRoadmap(clean);
    let roadmap = fallback;
    try {
      const completion = await this.ai.complete({
        userId,
        module: 'research',
        temperature: 0.2,
        maxTokens: 2200,
        jsonMode: true,
        messages: [
          {
            role: 'system',
            content:
              'You are a senior Indian law professor teaching legal research method. Do not answer the proposition directly. Return strict JSON only.',
          },
          {
            role: 'user',
            content: `Create an interactive legal research roadmap for this proposition: "${clean}".

Return JSON with keys: proposition, researchObjective, steps, recommendedSearchQueries, authorityHierarchy, noteTakingTemplate, finalPaperStructure. Steps must cover issue definition, statutes, bare acts, sections, Supreme Court cases, High Court cases, constitutional articles, Law Commission reports, journals, commentaries, search methodology, primary/secondary sources, research notes, and final paper structure.`,
          },
        ],
      });
      roadmap = { ...fallback, ...tryParseJson(completion.content, fallback), provider: completion.provider };
    } catch {
      roadmap.provider = 'local-fallback';
    }

    await this.cache.set('research', cacheKey, roadmap, { feature: 'legal-research-guide' });
    await this.guideRepo.save(this.guideRepo.create({ userId, proposition: clean, roadmap }));
    return roadmap;
  }

  async checkDraft(userId: string, body: { text?: string; fileName?: string; inputType?: string }) {
    const draftText = String(body.text || '').trim();
    const fallback = this.localDraftCheck(draftText);
    let result: any = fallback;

    if (draftText.length > 20) {
      try {
        const completion = await this.ai.complete({
          userId,
          module: 'notebook',
          temperature: 0.15,
          maxTokens: 3200,
          jsonMode: true,
          messages: [
            {
              role: 'system',
              content:
                'You are a senior advocate and legal drafting expert reviewing a legal draft. Return strict JSON only matching the schema requested. Be extremely thorough, analytical, and professional.',
            },
            {
              role: 'user',
              content: `Perform a comprehensive, professional legal review of this draft.

Draft:
${draftText.slice(0, 15000)}

Return a single JSON object with EXACTLY this structure (no additional markdown or wrapper text outside the JSON):
{
  "scores": {
    "overall": 75,
    "professionalReadiness": 70,
    "legalAccuracy": 78,
    "structure": 72,
    "language": 80,
    "formatting": 65,
    "citation": 60,
    "clauseCompleteness": 68,
    "logicalFlow": 74,
    "risk": 55,
    "compliance": 70
  },
  "sectionReview": [
    {
      "sectionName": "Title and Preamble",
      "purpose": "Identifies the agreement type, parties, and execution date.",
      "strengths": ["Party names are stated clearly."],
      "weaknesses": ["Fails to specify party capacities and registered addresses."],
      "missingInfo": ["Execution date is left blank.", "Recitals (Whereas clauses) are missing."],
      "legalRisks": ["Ambiguity in identifying corporate entities may lead to identification disputes."],
      "ambiguousLanguage": ["'The parties agree...' without clarifying corporate representations."],
      "poorDraftingPractices": ["Lack of structured definitions block for party terms."],
      "suggestedImprovements": ["Insert registered office address, CIN numbers for companies, and precise representation clauses."],
      "professionalRewrite": "This Agreement ('Agreement') is entered into on this [Date] by and between [Party A] and [Party B]..."
    }
  ],
  "clauseAnalysis": {
    "missing": [
      {
        "clauseName": "Dispute Resolution Clause",
        "suggestion": "Add a standard multi-tier dispute resolution clause recommending negotiation followed by arbitration under ICA rules."
      }
    ],
    "weak": [
      {
        "clauseName": "Termination Clause",
        "issue": "Termination is unilateral without specify notice period or cure period.",
        "alternative": "Provide 30 days written notice with a 15-day cure period for material breach."
      }
    ],
    "duplicate": [],
    "conflicting": [],
    "unenforceable": [],
    "illegal": [],
    "incomplete": []
  },
  "languageAnalysis": {
    "professionalTone": "The draft maintains a formal tone but lacks precise legal vocabulary.",
    "terminologyReview": "Terms like 'disputes' are used loosely; should refer to 'Disputes and Differences'.",
    "grammarAndSentence": "Long sentence blocks reduce legibility. Break into sub-clauses.",
    "readabilityScore": "Moderate. Professional readers will find it slightly wordy.",
    "clarityAndConsistency": "Terms are defined differently in different paragraphs.",
    "passiveVoiceCount": "High reliance on passive voice. E.g. 'Obligations shall be performed' instead of 'The Buyer shall perform obligations.'",
    "wordChoiceTips": ["Use 'shall' for mandatory duties.", "Avoid 'hereinabove' and 'hereinafter' where simple clause references suffice."]
  },
  "riskAnalysis": {
    "litigationRisks": ["Vague liability limits could expose the party to unlimited consequential damages."],
    "contractualRisks": ["Lack of indemnity makes recovering third-party claim costs difficult."],
    "regulatoryCompliance": ["Check local stamp duty acts for stamp paper requirements."],
    "jurisdictionIssues": "Jurisdiction is not exclusively locked to a specific city/state court.",
    "missingMandatoryElements": ["Definitions", "Remedies", "Dispute Resolution", "Confidentiality", "Governing Law"]
  },
  "citationAnalysis": {
    "verifiedCases": [],
    "statutoryReferences": [],
    "missingAuthorities": ["No references to statutory acts or governing sections detected."]
  },
  "rewrite": {
    "improvedDraft": "Complete polished draft content here...",
    "suggestedClauses": [
      {
        "title": "Governing Law & Jurisdiction",
        "text": "This Agreement shall be governed by and construed in accordance with the laws of India. The courts of [City] shall have exclusive jurisdiction."
      }
    ],
    "alternativePhrases": [
      {
        "original": "will handle conflicts",
        "proposed": "shall resolve all Disputes and Differences in accordance with Clause X",
        "rationale": "Tightens conflict scope and references the arbitration process."
      }
    ]
  },
  "finalSummary": {
    "executiveSummary": "Overall professional summary of the draft...",
    "strengths": ["Clear party names", "Simple wording"],
    "weaknesses": ["Vague termination terms", "No dispute resolution block"],
    "criticalIssues": ["Unlimited liability risk", "Vague jurisdiction"],
    "priorityFixes": ["Add dispute resolution clause", "Limit liability to contract value"],
    "recommendations": ["Refactor into numbered clauses", "Incorporate standard boilerplate clauses"]
  }
}`,
            },
          ],
        });
        result = { ...fallback, ...tryParseJson(completion.content, fallback), provider: completion.provider };
      } catch {
        result.provider = 'local-fallback';
      }
    }

    await this.draftCheckRepo.save(this.draftCheckRepo.create({
      userId,
      fileName: body.fileName || null,
      inputType: body.inputType || 'Pasted Text',
      draftText,
      result,
    }));
    return result;
  }

  listCourses() {
    return this.courseRepo.find({ order: { createdAt: 'DESC' } });
  }

  upsertCourse(body: Partial<DraftingAcademyCourse>) {
    const course = this.courseRepo.create({
      title: body.title || 'Untitled Drafting Course',
      category: body.category || 'Contract Drafting',
      description: body.description || '',
      contentType: body.contentType || 'Recorded Lecture',
      resourceUrl: body.resourceUrl || '',
      status: body.status || 'draft',
      metadata: body.metadata || {},
    });
    return this.courseRepo.save(course);
  }

  async deleteCourse(id: string) {
    await this.courseRepo.delete(id);
    return { success: true };
  }

  private extractCitations(text: string) {
    const matches = text.match(/\b(?:AIR|SCC|SCR|CriLJ|All LJ|INSC|MANU)[:\sA-Z0-9./()-]{5,80}|\b[A-Z][A-Za-z. ]+\s+v\.?\s+[A-Z][A-Za-z. ]+/g) || [];
    return Array.from(new Set(matches.map((item) => item.trim()).filter(Boolean))).slice(0, 12);
  }

  private localAuthorityVerification(query: string, answer: string, citations: string[]) {
    const textToSearch = `${query} ${answer}`.toLowerCase();
    
    // Default checks state
    let goodLawStatus = 'Valid';
    let bindingCourt = 'Supreme Court (Constitution Bench)';
    let riskLevel = 'Low';
    let confidenceScore = 95;
    
    const warnings: string[] = [];
    const details = {
      reason: 'The legal reasoning matches established precedents and current statutory parameters.',
      latestAuthority: 'K.S. Puttaswamy v. Union of India (2017) 10 SCC 1',
      relevantAmendment: 'None',
      newJudgment: 'None',
      conflictingJudgment: 'None',
      suggestedAuthority: 'Constitution of India, Article 21'
    };

    const primarySourcesList = [
      { name: 'Constitution of India', type: 'Article', authorityLevel: 'Supreme Constitutional Authority', date: '1950-01-26', status: 'Active', isValid: true },
      { name: 'Indian Contract Act, 1872', type: 'Act', authorityLevel: 'Central Legislature', date: '1872-09-01', status: 'Active', isValid: true }
    ];

    let recentAmendmentsCount = 0;
    let conflictingCount = 0;
    let citationAccuracy = 98;
    let reasoningConsistency = 'High';

    // 1. Check for repealed IPC statutes / BNS transitions
    if (textToSearch.includes('ipc') || textToSearch.includes('indian penal code') || textToSearch.includes('section 302') || textToSearch.includes('section 378')) {
      goodLawStatus = 'Repealed / Substituted';
      riskLevel = 'High';
      confidenceScore -= 40;
      recentAmendmentsCount += 1;
      warnings.push('⚠ Indian Penal Code (IPC) has been repealed and replaced by Bharatiya Nyaya Sanhita (BNS) in 2024.');
      details.reason = 'Statutory replacement of IPC with Bharatiya Nyaya Sanhita (BNS) has repealed old section numbers.';
      details.relevantAmendment = 'Bharatiya Nyaya Sanhita, 2023 (effective July 1, 2024)';
      details.suggestedAuthority = 'Section 103 BNS (in place of Section 302 IPC)';
      primarySourcesList.push({ name: 'Bharatiya Nyaya Sanhita, 2023', type: 'Central Act', authorityLevel: 'Parliament of India', date: '2023-12-25', status: 'Substituted Rule Active', isValid: true });
    }

    // 2. Check for IT Act Section 66A (struck down)
    if (textToSearch.includes('66a') || textToSearch.includes('offensive messages')) {
      goodLawStatus = 'Struck Down';
      riskLevel = 'High';
      confidenceScore -= 50;
      warnings.push('⚠ Section 66A of IT Act was struck down as unconstitutional in Shreya Singhal v. UOI (2015).');
      details.reason = 'Section 66A violates the freedom of speech guaranteed under Article 19(1)(a) and is not saved by Article 19(2).';
      details.latestAuthority = 'Shreya Singhal v. Union of India (2015) 5 SCC 1';
      details.suggestedAuthority = 'Article 19(1)(a), Constitution of India';
      primarySourcesList.push({ name: 'Information Technology Act, 2000 (Sec 66A)', type: 'Section', authorityLevel: 'Legislative Enactment', date: '2000-06-09', status: 'Unconstitutional / Void', isValid: false });
    }

    // 3. Check for Adultery Sec 497 (struck down)
    if (textToSearch.includes('497') || textToSearch.includes('adultery')) {
      goodLawStatus = 'Struck Down';
      riskLevel = 'High';
      confidenceScore -= 45;
      warnings.push('⚠ Section 497 of the IPC was struck down as unconstitutional in Joseph Shine v. UOI (2018).');
      details.reason = 'Adultery law was declared discriminatory and violative of Articles 14, 15 and 21 of the Constitution.';
      details.latestAuthority = 'Joseph Shine v. Union of India (2018) SCC OnLine SC 1676';
      details.suggestedAuthority = 'Article 14, Constitution of India';
      primarySourcesList.push({ name: 'Joseph Shine v. Union of India', type: 'Judicial Precedent', authorityLevel: 'Supreme Court (5-Judge Bench)', date: '2018-09-27', status: 'Active Law', isValid: true });
    }

    // 4. Check for verbal contracts conflicts
    if (textToSearch.includes('verbal') || textToSearch.includes('oral contract') || textToSearch.includes('oral agreement')) {
      conflictingCount += 2;
      confidenceScore -= 15;
      warnings.push('⚠ Conflicting High Court judgments exist regarding the evidentiary weight of oral testimonies.');
      details.reason = 'Evidentiary standard for oral agreements is high; must prove consensus ad idem under Section 10.';
      details.conflictingJudgment = 'Alka Bose v. Parmatma Devi (2009) 2 SCC 582';
      details.suggestedAuthority = 'Section 91 & 92 of Indian Evidence Act / Bharatiya Sakshya Adhiniyam';
    }

    // 5. Check for general citation presence
    if (citations.length === 0) {
      confidenceScore -= 20;
      riskLevel = riskLevel === 'High' ? 'High' : 'Medium';
      warnings.push('⚠ Citation does not fully support this proposition or no explicit citations were found.');
      reasoningConsistency = 'Medium';
      citationAccuracy = 0;
    }

    // Ensure confidence doesn't drop below 10 or exceed 100
    confidenceScore = Math.max(10, Math.min(100, confidenceScore));

    return {
      authorityStatus: warnings.length === 0 ? 'Verified' : 'Needs Attention',
      goodLawStatus,
      recentAmendments: recentAmendmentsCount > 0 ? `${recentAmendmentsCount} Amendment Found` : 'None',
      conflictingJudgments: conflictingCount > 0 ? `${conflictingCount} Found` : 'None Found',
      bindingCourt,
      citationValidation: citations.map((cit) => ({ citation: cit, status: citationAccuracy > 50 ? 'Valid' : 'Unverified', paragraphSupport: 'Verified' })),
      confidenceScore,
      riskLevel,
      verificationTimestamp: new Date().toISOString(),
      primarySources: primarySourcesList.map(s => s.name),
      professionalSummary: warnings.length === 0 
        ? 'All cited statutory authorities, court precedents, and articles are verified as active and valid under Indian Jurisprudence.'
        : `Verification flagged issues: ${warnings.join(' ')}`,
      unsupportedReasoning: warnings,
      details,
      sources: primarySourcesList,
      paragraphSupportChecks: citations.map((cit) => ({ citation: cit, supportsProposition: 'Verified' }))
    };
  }

  private localResearchRoadmap(proposition: string) {
    const topic = proposition || 'the legal proposition';
    return {
      originalQuestion: topic,
      legalIssue: `Whether the legal principles and statutory framework governing ${topic} are enforceable and valid under Indian law.`,
      keywords: {
        primary: [topic, 'Indian law enforcement', 'statutory compliance'],
        alternative: [`validity of ${topic}`, `regulation of ${topic} in India`],
        phrases: [`enforcement of ${topic}`, 'legal liability for ' + topic],
        latinMaxims: ['Pacta sunt servanda', 'Ubi jus ibi remedium'],
        doctrines: ['Doctrine of Severability', 'Doctrine of Legitimate Expectation']
      },
      relevantLaws: [
        {
          source: 'Applicable Central Act / Legislative Statutes',
          details: 'Core governing provisions and regulatory sections',
          whyItMatters: 'Establishes the foundational statutory definition, scope, and direct legal compliance parameters.'
        },
        {
          source: 'Constitution of India',
          details: 'Relevant Articles (e.g. Article 14, Article 19, Article 21)',
          whyItMatters: 'Determines constitutional validity, fundamental rights implications, or division of legislative power.'
        }
      ],
      relevantCases: [
        {
          caseName: 'Landmark Case v. Union of India (Example Citation)',
          type: 'Landmark Supreme Court Case',
          relevance: 'Lays down the basic test and guidelines for this legal topic.',
          ratioDecidendi: 'The Supreme Court ruled that rights and liabilities must align with express statutory mandate.',
          legalPrinciple: 'Statutory supremacy and rule of law.',
          isGoodLaw: 'Yes, still good law and widely cited.',
          bindingValue: 'Binding on all courts in India under Article 141 of the Constitution.'
        }
      ],
      researchSources: [
        {
          source: 'SCC Online / Manupatra / Indian Kanoon',
          whyItMatters: 'Essential databases for searching primary case law, statutes, and notifications.'
        },
        {
          source: 'Supreme Court & High Court Websites',
          whyItMatters: 'Consult for the most recent, unedited certified copies of judgments.'
        }
      ],
      methodology: [
        { step: 1, title: 'Read the Bare Act', explanation: 'Start by finding the relevant Central/State Act and read the sections closely without commentaries.' },
        { step: 2, title: 'Understand definitions', explanation: 'Refer to the Definition section (usually Section 2) of the Act to check how key terms are defined.' },
        { step: 3, title: 'Read relevant sections', explanation: 'Read the specific sections that address your proposition along with any exceptions or provisos.' },
        { step: 4, title: 'Identify leading Supreme Court judgments', explanation: 'Search for landmark judgments by the Supreme Court of India that interpret these sections.' },
        { step: 5, title: 'Read High Court judgments', explanation: 'Look for judgments from your jurisdictional High Court to understand local application and coordinate bench decisions.' },
        { step: 6, title: 'Check amendments', explanation: 'Ensure that the statutory sections you are reading have not been amended recently by checking latest amendment acts.' },
        { step: 7, title: 'Check overruling judgments', explanation: 'Verify that the landmark cases you found have not been overruled or distinguished by larger benches.' },
        { step: 8, title: 'Read Law Commission Reports', explanation: 'Look at Law Commission reports for legislative intent and recommendations on reforms.' },
        { step: 9, title: 'Read academic commentary', explanation: 'Read standard textbooks and legal commentaries (like Mulla, Sarkar) to get an in-depth analysis.' },
        { step: 10, title: 'Prepare research notes', explanation: 'Synthesize the gathered material into structured research notes classifying facts, issues, rules, and ratio.' }
      ],
      strategy: {
        searchQueries: [`"${topic}" India`, `enforcement of "${topic}"`],
        booleanOperators: [`"${topic}" AND "Supreme Court"`, `"${topic}" OR "enforcement" NOT "criminal"`],
        alternativeSearchTerms: [`validity of ${topic}`, `breach of ${topic}`],
        citationSearches: ['Search by citation if you find specific landmark cases in textbooks'],
        sectionSearches: ['Search by Section number along with the Act name in databases'],
        topicSearches: ['Search under broad category filters on SCC Online / Manupatra'],
        judgeSearches: ['Filter by Bench/Judge who authored landmark rulings on this topic'],
        actSearches: ['Search by the name of the specific Act to view all related judgments']
      },
      primaryVsSecondary: {
        primarySources: ['Bare Acts', 'Supreme Court Judgments', 'High Court Judgments', 'Official Gazette Notifications'],
        secondarySources: ['Legal Treatises', 'Law Review Articles', 'Legal Blogs', 'Commentaries'],
        hierarchyExplanation: 'Primary sources carry binding or high persuasive legal weight. Secondary sources are only illustrative/persuasive and should never be cited as direct authority if primary sources are available.'
      },
      commonMistakes: [
        {
          mistake: 'Using outdated cases',
          warning: 'Relying on a judgment that has been overruled by a larger bench or nullified by a later statutory amendment.'
        },
        {
          mistake: 'Ignoring amendments',
          warning: 'Relying on old statutory text that has since been modified or repealed.'
        },
        {
          mistake: 'Relying on blogs',
          warning: 'Treating summary legal articles or blog posts as binding authority instead of reading the actual judgments.'
        }
      ],
      checklist: [
        'Bare Act read',
        'Relevant sections identified',
        'Landmark cases read',
        'Latest cases checked',
        'Amendments verified',
        'Conflicting judgments reviewed',
        'Research notes prepared'
      ],
      provider: 'local-fallback'
    };
  }

  private localDraftCheck(text: string) {
    const words = text.split(/\s+/).filter(Boolean).length;
    const hasClauses = /\b(whereas|therefore|clause|party|obligation|termination|jurisdiction|signature)\b/i.test(text);
    const score = Math.max(35, Math.min(88, 45 + Math.floor(words / 25) + (hasClauses ? 18 : 0)));
    return {
      scores: {
        overall: score,
        professionalReadiness: Math.max(30, score - 5),
        legalAccuracy: Math.max(30, score - 2),
        structure: hasClauses ? Math.min(95, score + 12) : 40,
        language: Math.min(92, score + 4),
        formatting: hasClauses ? Math.min(90, score + 8) : 42,
        citation: /\b(AIR|SCC|Section|Article)\b/i.test(text) ? 75 : 30,
        clauseCompleteness: hasClauses ? Math.min(88, score + 6) : 35,
        logicalFlow: Math.min(90, score + 2),
        risk: Math.max(20, 100 - score),
        compliance: Math.max(30, score - 8)
      },
      sectionReview: [
        {
          sectionName: 'Preamble and Party Recitals',
          purpose: 'Identifies the parties entering the agreement and lists background context.',
          strengths: ['Identifies party names and descriptions.'],
          weaknesses: ['Does not state registered corporate identifiers or capacities clearly.'],
          missingInfo: ['Corporate identification numbers (CIN), date of execution, place of execution.'],
          legalRisks: ['Vagueness in corporate description could delay service of notice or enforceability.'],
          ambiguousLanguage: ['Use of colloquial terms to describe representatives.'],
          poorDraftingPractices: ['Lacks a clear, structured Definitions block.'],
          suggestedImprovements: ['Structure with standard, numbered party descriptions and recitals.'],
          professionalRewrite: 'This agreement is made on this ___ day of ___, 2026, by and between...'
        }
      ],
      clauseAnalysis: {
        missing: [
          { clauseName: 'Dispute Resolution Clause', suggestion: 'Incorporate a multi-tier dispute resolution clause (negotiation -> arbitration).' },
          { clauseName: 'Force Majeure Clause', suggestion: 'Provide standard boilerplate protections for unexpected events out of party control.' }
        ],
        weak: [
          { clauseName: 'Termination Clause', issue: 'Termination notice period is not defined.', alternative: 'Add: Either party may terminate this agreement upon 30 days written notice.' }
        ],
        duplicate: [],
        conflicting: [],
        unenforceable: [],
        illegal: [],
        incomplete: []
      },
      languageAnalysis: {
        professionalTone: 'Formal but contains structural loopholes.',
        terminologyReview: 'Use professional terms like "Indemnify" instead of "repay".',
        grammarAndSentence: 'Some sentences are overly verbose. Restructure as numbered lists.',
        readabilityScore: '68/100 (Standard readability).',
        clarityAndConsistency: 'Use consistent terms for referencing the same parties (e.g. avoid mixing Buyer and Purchaser).',
        passiveVoiceCount: 'Moderate passive voice usage.',
        wordChoiceTips: ['Replace colloquial terms with formal legal synonyms.']
      },
      riskAnalysis: {
        litigationRisks: ['Ambiguity in termination could lead to wrongful termination suits.'],
        contractualRisks: ['No cap on liability exposes the drafting party to unlimited damages.'],
        regulatoryCompliance: ['Stamp duty verification required depending on place of execution.'],
        jurisdictionIssues: 'No exclusive jurisdiction clause is defined.',
        missingMandatoryElements: ['Remedies', 'Definitions', 'Dispute Resolution', 'Governing Law', 'Severability', 'Indemnification']
      },
      citationAnalysis: {
        verifiedCases: [],
        statutoryReferences: [],
        missingAuthorities: ['No statutory acts or leading judicial cases are cited in this draft.']
      },
      rewrite: {
        improvedDraft: text ? `${text}\n\n[Mentor's Recommended Draft Polish]\nUse standard numbered sections, define key entities, outline rights, obligations, remedies, boilerplate parameters, and execution blocks.` : '',
        suggestedClauses: [
          { title: 'Governing Law & Dispute Resolution', text: 'This Agreement shall be governed by and construed in accordance with the laws of India. All disputes arising out of this Agreement shall be referred to arbitration.' }
        ],
        alternativePhrases: [
          { original: 'if things go wrong', proposed: 'In the event of a Material Breach', rationale: 'Standard legal threshold for contract default and invoking remedies.' }
        ]
      },
      finalSummary: {
        executiveSummary: 'The draft contains basic terms but lacks professional structure, mandatory boilerplate clauses, and risk limits.',
        strengths: ['Simple language structure', 'Core terms identified'],
        weaknesses: ['No liability limit', 'Vague jurisdiction', 'Missing default remedies'],
        criticalIssues: ['High litigation exposure due to missing boilerplate elements.'],
        priorityFixes: ['Define governing law and exclusive court jurisdiction', 'Limit liability to contract value'],
        recommendations: ['Insert multi-tier dispute resolution and indemnity blocks.']
      },
      provider: 'local-fallback'
    };
  }

  async explainBareAct(userId: string, body: { actName: string; chapter: string; part?: string; section: string }) {
    const actName = String(body.actName || '').trim();
    const chapter = String(body.chapter || '').trim();
    const part = String(body.part || '').trim();
    const section = String(body.section || '').trim();
    
    const fallback = this.localExplainBareAct(actName, chapter, part, section);
    let result = fallback;
    try {
      const completion = await this.ai.complete({
        userId,
        module: 'research',
        temperature: 0.2,
        maxTokens: 2500,
        jsonMode: true,
        messages: [
          {
            role: 'system',
            content: 'You are a senior constitutional law professor teaching the interpretation of legislation. Your goal is to make the student understand the Bare Act deeply. Return strict JSON only matching the schema requested.',
          },
          {
            role: 'user',
            content: `Explain Section/Article ${section} of the "${actName}" (Chapter: "${chapter}", Part: "${part || 'N/A'}").
            
            Return strict JSON matching this exact structure:
            {
              "purpose": "A detailed explanation of why this provision was enacted, what legal problem it solves, and its historical context.",
              "importantKeywords": [
                { "word": "keyword", "explanation": "detailed legal definition" }
              ],
              "legislativeIntent": "The legislative intent and guidelines for how this section should be interpreted by the judiciary.",
              "commonMistakes": [
                { "mistake": "common error", "explanation": "why it is wrong" }
              ],
              "memoryTricks": ["Trick 1", "Trick 2"],
              "realLifeIllustrations": ["Illustration 1", "Illustration 2"],
              "landmarkJudgments": [
                { "caseName": "Case X v. Y", "citation": "1997 SCC ...", "ratio": "Key binding legal principle established." }
              ],
              "relatedProvisions": [
                { "provision": "Section/Article Z", "relationship": "how it interacts with this section" }
              ],
              "examQuestions": ["Question 1", "Question 2"],
              "mootCourtRelevance": "How this section is applied in simulated advocacy or moot compromis scenarios.",
              "lawyerTips": ["Tip 1", "Tip 2"]
            }`,
          }
        ]
      });
      result = { ...fallback, ...tryParseJson(completion.content, fallback), provider: completion.provider };
    } catch {
      result.provider = 'local-fallback';
    }
    return result;
  }

  async simplifyBareAct(userId: string, body: { actName: string; chapter: string; section: string; clause?: string }) {
    const actName = String(body.actName || '').trim();
    const chapter = String(body.chapter || '').trim();
    const section = String(body.section || '').trim();
    const clause = String(body.clause || '').trim();

    const fallback = this.localSimplifyBareAct(actName, chapter, section, clause);
    let result = fallback;
    try {
      const completion = await this.ai.complete({
        userId,
        module: 'research',
        temperature: 0.15,
        maxTokens: 2500,
        jsonMode: true,
        messages: [
          {
            role: 'system',
            content: 'You are an AI legal language simplifier. Convert difficult legal language into simple English while strictly preserving the legal meaning. Return strict JSON only matching the schema requested.',
          },
          {
            role: 'user',
            content: `Simplify Section/Article ${section} (Clause: ${clause || 'N/A'}) of the "${actName}" (Chapter: "${chapter}").
            
            Return strict JSON matching this exact structure:
            {
              "oneLineSummary": "Concise summary in one sentence.",
              "originalText": "The actual statutory phrasing of this section/clause.",
              "plainEnglishText": "Plain English simplified version.",
              "detailedExplanation": "Detailed step-by-step clause-wise breakdown.",
              "visualFlowText": "Flowchart logic, e.g. If Condition A -> Action B -> Else C",
              "keyPoints": ["Point 1", "Point 2"],
              "exceptions": ["Exception/Proviso 1", "Exception/Proviso 2"],
              "caseLaws": [
                { "caseName": "Landmark Case", "principle": "Simplified rule of law" }
              ],
              "relatedSections": ["Section A", "Section B"],
              "importantLegalTerms": [
                { "term": "term", "definition": "simple explanation" }
              ],
              "examNotes": ["Highlight 1", "Highlight 2"],
              "faqs": [
                { "question": "FAQ 1", "answer": "Answer 1" }
              ]
            }`,
          }
        ]
      });
      result = { ...fallback, ...tryParseJson(completion.content, fallback), provider: completion.provider };
    } catch {
      result.provider = 'local-fallback';
    }
    return result;
  }

  async analyzeBareActIntelligence(userId: string, body: { provisionText: string; actName?: string; sectionRef?: string }) {
    const provisionText = String(body.provisionText || '').trim();
    const actName = String(body.actName || 'Unknown Act').trim();
    const sectionRef = String(body.sectionRef || 'Provision').trim();

    const systemPrompt = `You are a senior Indian legal scholar, law professor, and advocate with 30 years of experience.
You provide exhaustively accurate, exam-ready legal analysis of Indian bare act provisions.
CRITICAL RULES:
- Never hallucinate cases. Only cite cases you are highly confident exist with correct citations.
- If you cannot find real judgments, explicitly say "No landmark judgments identified for this provision" in that field.
- Follow the exact JSON schema requested.
- Write in clear, formal, legal textbook English.
- All analysis must be strictly based on the provided provision text.`;

    const userPrompt = `Analyze the following bare act provision from "${actName}" (${sectionRef}):

---
${provisionText}
---

Return a STRICT JSON object with EXACTLY these keys:

{
  "originalBareAct": "The provision text as written, cleaned and formatted",
  "plainEnglish": "Simple everyday English translation of the provision (2-4 sentences)",
  "clauseBreakdown": [{"clause": "sub-clause or phrase", "meaning": "explanation"}],
  "importantTerms": [{"term": "legal term", "definition": "precise legal definition"}],
  "stepByStep": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
  "elements": ["Essential element 1", "Essential element 2"],
  "objectOfLaw": "The legislative purpose and object of this provision",
  "conditions": ["Condition 1 for applicability", "Condition 2"],
  "exceptions": ["Exception/Proviso 1", "Exception/Proviso 2 (or 'No exceptions found in this provision')"],
  "legalEffect": "The legal consequences that flow from this provision when applied",
  "practicalExample": "A realistic practical scenario showing how this provision operates",
  "hypotheticalScenario": "A law school hypothetical problem with analysis",
  "importantJudgments": [{"caseName": "Full Case Name", "citation": "Year AIR/SCC Citation", "ratio": "Legal principle established", "relevance": "How it applies to this provision"}],
  "noJudgmentsNote": "Leave empty string if judgments found, else: 'No verified landmark judgments identified for this specific provision.'",
  "relatedConstitutionalArticles": [{"article": "Article number", "connection": "How it relates"}],
  "relatedSections": [{"section": "Section/Rule number", "actName": "Act name", "connection": "How it relates"}],
  "legalDoctrines": [{"doctrine": "Doctrine name", "explanation": "How it applies here"}],
  "examNotes": ["Key exam point 1", "Key exam point 2", "Key exam point 3"],
  "memoryTricks": ["Mnemonic or trick 1", "Mnemonic or trick 2"],
  "flowchart": ["Start: ...", "Check: Condition A?", "Yes → Action B", "No → Action C", "End: Result"],
  "mindMap": {"center": "Core concept", "branches": [{"branch": "Branch name", "leaves": ["Leaf 1", "Leaf 2"]}]},
  "importantKeywords": ["keyword1", "keyword2", "keyword3"],
  "examQuestions": {
    "short": ["Short answer Q1", "Short answer Q2"],
    "long": ["Long essay Q1", "Long essay Q2"],
    "problem": ["Problem question Q1"],
    "mcq": [{"question": "MCQ question?", "options": ["A. Option", "B. Option", "C. Option", "D. Option"], "correct": "B"}]
  },
  "commonMistakes": [{"mistake": "Common error", "correction": "Correct understanding"}],
  "advocateView": "How a practicing advocate would use or argue this provision in court",
  "judgeView": "How a judge would interpret and apply this provision while deciding a case",
  "researchNotes": ["Research angle 1", "Research angle 2"],
  "citations": [{"type": "Primary/Secondary", "reference": "Full citation"}]
}`;

    const fallback = {
      originalBareAct: provisionText,
      plainEnglish: `This provision under ${actName} establishes legal obligations and rights. Plain English analysis unavailable — AI service offline.`,
      clauseBreakdown: [{ clause: provisionText.substring(0, 100), meaning: 'Analysis pending — AI offline' }],
      importantTerms: [{ term: 'Statutory Provision', definition: 'A rule or regulation enacted by a legislative body.' }],
      stepByStep: ['Step 1: Read the provision carefully', 'Step 2: Identify the parties', 'Step 3: Determine applicability'],
      elements: ['Legal subject matter', 'Competent parties', 'Lawful object'],
      objectOfLaw: `The ${actName} aims to codify and regulate legal relationships in this area of law.`,
      conditions: ['Provision applies as stated', 'Subject to other provisions of the Act'],
      exceptions: ['No exceptions could be identified offline'],
      legalEffect: 'Creates legally enforceable rights and obligations as per the provision text.',
      practicalExample: 'Analysis requires AI connection. Please try again.',
      hypotheticalScenario: 'Analysis requires AI connection. Please try again.',
      importantJudgments: [],
      noJudgmentsNote: 'AI offline — could not retrieve verified judgments.',
      relatedConstitutionalArticles: [],
      relatedSections: [],
      legalDoctrines: [],
      examNotes: ['Read the provision multiple times', 'Note key words like "shall", "may", "notwithstanding"'],
      memoryTricks: ['Break the provision into subject, predicate, and object', 'Focus on operative words'],
      flowchart: ['Start: Provision triggered', 'Check: Conditions met?', 'Yes → Legal effect applies', 'No → Provision inapplicable', 'End: Outcome determined'],
      mindMap: { center: sectionRef, branches: [{ branch: actName, leaves: ['Study provision text', 'Identify key terms'] }] },
      importantKeywords: ['Statutory', 'Provision', 'Legal effect'],
      examQuestions: {
        short: [`What is the object of ${sectionRef}?`, `Define the key terms in ${sectionRef}.`],
        long: [`Discuss the scope and application of ${sectionRef} with reference to relevant case law.`],
        problem: [`A and B enter into an arrangement. Applying ${sectionRef}, advise the parties.`],
        mcq: [{ question: `Which Act contains ${sectionRef}?`, options: [`A. ${actName}`, 'B. IPC', 'C. CPC', 'D. Evidence Act'], correct: 'A' }],
      },
      commonMistakes: [{ mistake: 'Ignoring provisos', correction: 'Always read provisos as they carve out exceptions to the main rule.' }],
      advocateView: 'Analysis requires AI connection.',
      judgeView: 'Analysis requires AI connection.',
      researchNotes: ['Consult Mulla\'s Commentary', 'Check latest Supreme Court judgments on this provision'],
      citations: [{ type: 'Primary', reference: `${actName}, ${sectionRef}` }],
      provider: 'local-fallback',
    };

    let result: any = fallback;
    try {
      const completion = await this.ai.complete({
        userId,
        module: 'research',
        temperature: 0.15,
        maxTokens: 4000,
        jsonMode: true,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });
      result = { ...fallback, ...tryParseJson(completion.content, fallback), provider: completion.provider, model: completion.model };
    } catch {
      result.provider = 'local-fallback';
    }
    return result;
  }

  async professorTeach(userId: string, body: {
    provisionText: string;
    actName?: string;
    sectionRef?: string;
    step: number;
    action: 'teach' | 'doubt' | 'example' | 'simpler' | 'deeper' | 'court' | 'exam' | 'quiz_answer';
    userMessage?: string;
    sessionContext?: string;
    quizAnswer?: string;
  }) {
    const provisionText = String(body.provisionText || '').trim();
    const actName = String(body.actName || 'the Act').trim();
    const sectionRef = String(body.sectionRef || 'this provision').trim();
    const step = Number(body.step || 1);
    const action = body.action || 'teach';
    const userMessage = String(body.userMessage || '').trim();
    const sessionContext = String(body.sessionContext || '').trim();

    const PROFESSOR_SYSTEM = `You are Professor LexMentor, a senior faculty member at a National Law University with 30 years of teaching experience. You are teaching a law student RIGHT NOW in an interactive classroom session.

TEACHING RULES:
- Speak directly to the student in second person ("Notice how...", "Consider this...", "You will observe...")
- Use the Socratic method — pose questions to provoke thinking
- Never give generic ChatGPT explanations — be specific, precise, scholarly
- Never hallucinate case laws — only cite cases you are highly confident are real
- Never alter the statutory language — quote it exactly
- Teach one concept at a time — do not overwhelm
- Use "Notice...", "Observe...", "Let me draw your attention to...", "An excellent question arises here..."
- End each teaching with a thought-provoking question or an insight
- Tone: authoritative, warm, Socratic, professorial

Return STRICT JSON only. No markdown outside the JSON.`;

    const stepPrompts: Record<number, string> = {
      1: `You are teaching STEP 1: Presenting the Original Bare Act Text.

Provision: "${provisionText}"
Act: ${actName}, ${sectionRef}

Return JSON:
{
  "stepTitle": "Step 1: The Original Text",
  "professorIntro": "A warm, engaging 2-sentence introduction to this provision — what the student is about to study",
  "originalText": "The exact provision text, word-for-word",
  "highlights": [
    { "type": "definition", "phrase": "exact phrase from text", "label": "Definition" },
    { "type": "condition", "phrase": "exact phrase from text", "label": "Condition" },
    { "type": "exception", "phrase": "exact phrase from text", "label": "Exception/Proviso" },
    { "type": "punishment", "phrase": "exact phrase from text", "label": "Punishment" },
    { "type": "keyword", "phrase": "exact phrase from text", "label": "Key Legal Term" }
  ],
  "professorNote": "A 3-4 sentence scholarly observation about this provision — what makes it special or interesting",
  "socraticQuestion": "One thought-provoking question to the student about what they just read",
  "clickableTerms": [
    { "term": "difficult legal term from text", "quickDef": "one-line definition" }
  ]
}`,

      2: `You are teaching STEP 2: Historical Background and Legislative Intent.

Provision: "${provisionText}"
Act: ${actName}, ${sectionRef}
Session so far: ${sessionContext}

Return JSON:
{
  "stepTitle": "Step 2: Background & Legislative Intent",
  "professorIntro": "2 sentences setting up why background matters",
  "historicalContext": "3-4 paragraphs covering: when the law was enacted, the social/legal problem it addressed, the pre-existing legal vacuum, and the events or conditions that necessitated this provision. Be specific and historically accurate.",
  "legislativeIntent": "2-3 paragraphs on what the legislature specifically intended — the mischief sought to be remedied, the purpose, and the objective",
  "evolution": "How this provision has evolved — amendments, replacements, or judicial additions over the years",
  "comparativeLaw": "Brief note on whether similar provisions exist in other jurisdictions (English law, American law) if relevant",
  "professorNote": "A scholarly observation connecting the history to the present text",
  "socraticQuestion": "One question asking the student to connect historical purpose to the exact words used"
}`,

      3: `You are teaching STEP 3: Sentence-by-Sentence Deep Analysis.

Provision: "${provisionText}"
Act: ${actName}, ${sectionRef}
Session so far: ${sessionContext}

Break EVERY sentence and clause separately. Do not merge them.

Return JSON:
{
  "stepTitle": "Step 3: Clause-by-Clause Analysis",
  "professorIntro": "2 sentences explaining the sentence-level approach",
  "sentences": [
    {
      "id": 1,
      "text": "Exact sentence or clause from provision",
      "grammaticalNote": "Subject, verb, object breakdown",
      "legalMeaning": "What this sentence legally means",
      "whyWritten": "Why the legislature wrote it this way",
      "consequences": "What happens legally if this clause is ignored or violated",
      "keywords": ["important word 1", "important word 2"]
    }
  ],
  "structuralObservation": "How the clauses relate to each other — the architecture of the provision",
  "professorNote": "Key insight about clause construction",
  "socraticQuestion": "Ask student to identify which clause carries the maximum legal weight"
}`,

      4: `You are teaching STEP 4: Legal Terminology Deep Dive.

Provision: "${provisionText}"
Act: ${actName}, ${sectionRef}
Session so far: ${sessionContext}

Extract every legally significant term and teach it in depth.

Return JSON:
{
  "stepTitle": "Step 4: Legal Terms Decoded",
  "professorIntro": "2 sentences on why legal terminology matters in statutory interpretation",
  "terms": [
    {
      "term": "Legal term from provision",
      "statutoryDefinition": "Definition as given in the Act (if defined) or 'Not defined in this Act'",
      "legalDictionary": "Definition from Blacks Law Dictionary or equivalent",
      "courtInterpretation": "How Indian courts have interpreted this term — cite actual cases if confident, else say 'To be verified'",
      "practicalMeaning": "Plain English meaning for a layperson",
      "examImportance": "Why this term is frequently tested"
    }
  ],
  "wordOfCaution": "Common student mistakes in interpreting these terms",
  "professorNote": "A scholarly note on statutory language precision",
  "socraticQuestion": "Ask student to spot which term has the widest scope"
}`,

      5: `You are teaching STEP 5: Clause-by-Clause Legal Analysis — Why, What, Who.

Provision: "${provisionText}"
Act: ${actName}, ${sectionRef}
Session so far: ${sessionContext}

For EACH distinct clause or condition in the provision, answer 5 questions.

Return JSON:
{
  "stepTitle": "Step 5: Deep Clause Analysis",
  "professorIntro": "2 sentences framing this analytical approach",
  "clauses": [
    {
      "clause": "Exact clause text",
      "whatItMeans": "Precise legal meaning",
      "whyItIsWritten": "Legislative purpose of this specific clause",
      "whatIfIgnored": "Legal consequence of violating or ignoring this clause",
      "whoBenefits": "Which party or class of people benefits from this clause",
      "whenApplicable": "Conditions under which this clause activates",
      "courtView": "Real interpretation by courts if known, else 'Pending judicial clarification'"
    }
  ],
  "professorNote": "Observation on how these clauses interlock",
  "socraticQuestion": "Which clause creates the most litigation and why?"
}`,

      6: `You are teaching STEP 6: Practical Examples.

Provision: "${provisionText}"
Act: ${actName}, ${sectionRef}
Session so far: ${sessionContext}

Return JSON:
{
  "stepTitle": "Step 6: Practical Examples",
  "professorIntro": "2 sentences on learning through examples",
  "examples": [
    {
      "type": "Everyday Life Example",
      "scenario": "A realistic everyday situation involving common people",
      "analysis": "How the provision applies — step by step",
      "outcome": "Legal result"
    },
    {
      "type": "Business & Commercial Example",
      "scenario": "A business or corporate situation",
      "analysis": "How the provision applies",
      "outcome": "Legal result"
    },
    {
      "type": "Litigation Example",
      "scenario": "A courtroom or dispute scenario",
      "analysis": "Arguments on both sides",
      "outcome": "How a court would likely decide"
    },
    {
      "type": "Edge Case / Tricky Example",
      "scenario": "A borderline case that tests the provision's limits",
      "analysis": "Where the law is ambiguous",
      "outcome": "What the student should argue"
    }
  ],
  "professorNote": "Key insight from comparing these examples",
  "socraticQuestion": "Ask student to create their own example"
}`,

      7: `You are teaching STEP 7: Visual Diagrams — Flowchart, Decision Tree, Mind Map.

Provision: "${provisionText}"
Act: ${actName}, ${sectionRef}
Session so far: ${sessionContext}

Return JSON:
{
  "stepTitle": "Step 7: Visual Understanding",
  "professorIntro": "2 sentences on why visual learning reinforces statutory understanding",
  "flowchart": {
    "title": "How ${sectionRef} Works",
    "nodes": [
      { "id": "start", "type": "start", "text": "Starting condition" },
      { "id": "check1", "type": "decision", "text": "First condition met?" },
      { "id": "yes1", "type": "action", "text": "If yes..." },
      { "id": "no1", "type": "action", "text": "If no..." },
      { "id": "end", "type": "end", "text": "Legal outcome" }
    ],
    "edges": [
      { "from": "start", "to": "check1" },
      { "from": "check1", "to": "yes1", "label": "Yes" },
      { "from": "check1", "to": "no1", "label": "No" },
      { "from": "yes1", "to": "end" }
    ]
  },
  "decisionTree": [
    { "question": "Is condition A present?", "yes": "Apply clause 1", "no": "Section does not apply" },
    { "question": "Is condition B also present?", "yes": "Full legal effect", "no": "Partial application" }
  ],
  "mindMap": {
    "center": "${sectionRef}",
    "branches": [
      { "label": "Branch topic", "children": ["Child 1", "Child 2"] }
    ]
  },
  "timeline": ["Event 1 → legal consequence", "Event 2 → next step"],
  "professorNote": "How these diagrams help in examination answers",
  "socraticQuestion": "Can you draw this provision as a flowchart from memory?"
}`,

      8: `You are teaching STEP 8: Rules of Statutory Interpretation.

Provision: "${provisionText}"
Act: ${actName}, ${sectionRef}
Session so far: ${sessionContext}

Apply the four rules of interpretation to this specific provision.

Return JSON:
{
  "stepTitle": "Step 8: How Courts Interpret This",
  "professorIntro": "2 sentences on why interpretation matters",
  "literalRule": { "explanation": "What the literal reading of this provision means", "result": "Outcome if applied literally", "judgeComment": "Sample judicial observation on literal reading" },
  "goldenRule": { "explanation": "How the golden rule modifies the literal reading to avoid absurdity", "result": "Modified outcome", "example": "A situation where literal rule would give absurd result" },
  "mischiefrule": { "explanation": "The Heydon's Case mischief rule: what mischief was this provision designed to cure?", "result": "Interpretation that best cures the mischief", "application": "How courts have applied this to this provision type" },
  "purposiveInterpretation": { "explanation": "The modern approach: interpreting in light of purpose", "result": "Purposive reading of this provision", "relevantCases": "Any known cases applying purposive interpretation here" },
  "preferredApproach": "Which rule courts most commonly apply to this type of provision and why",
  "professorNote": "A scholarly note on interpretation wars in Indian courts",
  "socraticQuestion": "If two interpretations are equally valid, which should a judge prefer?"
}`,

      9: `You are teaching STEP 9: Landmark Cases & Judicial Evolution.

Provision: "${provisionText}"
Act: ${actName}, ${sectionRef}
Session so far: ${sessionContext}

CRITICAL: Only cite cases you are HIGHLY CONFIDENT are real. If uncertain, say so explicitly.

Return JSON:
{
  "stepTitle": "Step 9: Landmark Judgments",
  "professorIntro": "2 sentences on how case law breathes life into statutory text",
  "caveat": "Note about verification: these cases are cited to the best of the professor's knowledge — always verify from SCC/AIR before use in court",
  "judgments": [
    {
      "caseName": "Full case name",
      "citation": "Year AIR/SCC reference",
      "confidence": "HIGH / MEDIUM (if medium, note to verify)",
      "facts": "Brief facts of the case",
      "issue": "The precise legal question before the court regarding this provision",
      "arguments": { "petitioner": "Arguments made", "respondent": "Arguments made" },
      "reasoning": "How the court reasoned through the provision",
      "ratiodecidendi": "The binding legal principle established",
      "holding": "Final decision",
      "impact": "How this case changed the interpretation of this provision"
    }
  ],
  "noJudgmentsNote": "If no cases found: 'No landmark judgments verified for this specific provision. Students should consult current SCC/AIR databases.'",
  "judicialTrend": "Overall trend in how courts are interpreting this provision over time",
  "professorNote": "Which case the professor considers most important and why",
  "socraticQuestion": "If you were the judge in [case], how would you have decided?"
}`,

      10: `You are teaching STEP 10: Multi-Perspective Analysis.

Provision: "${provisionText}"
Act: ${actName}, ${sectionRef}
Session so far: ${sessionContext}

Return JSON:
{
  "stepTitle": "Step 10: Different Perspectives",
  "professorIntro": "2 sentences on why perspective matters in law",
  "perspectives": [
    { "role": "Law Student", "focus": "Examination angle — what to remember, what gets marks", "keyPoints": ["Point 1", "Point 2"] },
    { "role": "Defense Lawyer", "focus": "How to use this provision to defend a client", "arguments": ["Argument 1", "Argument 2"] },
    { "role": "Prosecutor / Petitioner's Advocate", "focus": "How to invoke this provision aggressively", "arguments": ["Argument 1", "Argument 2"] },
    { "role": "Judge", "focus": "What a judge looks for when applying this provision", "considerations": ["Factor 1", "Factor 2"] },
    { "role": "UPSC / Judiciary Aspirant", "focus": "The constitutional and policy angle", "points": ["Point 1", "Point 2"] },
    { "role": "Legal Researcher / Academic", "focus": "Academic debates and critiques of this provision", "angles": ["Debate 1", "Debate 2"] }
  ],
  "professorNote": "Which perspective is most tested in examinations",
  "socraticQuestion": "Which perspective do you find most challenging and why?"
}`,

      11: `You are teaching STEP 11: Memory Aids and Revision Tools.

Provision: "${provisionText}"
Act: ${actName}, ${sectionRef}
Session so far: ${sessionContext}

Return JSON:
{
  "stepTitle": "Step 11: Memory Aids",
  "professorIntro": "2 sentences on why memory tools matter in law",
  "mnemonic": { "acronym": "A word or acronym", "expansion": "What each letter stands for", "howToUse": "How to apply it to recall this provision" },
  "memoryStory": "A short memorable story or analogy that encodes the essence of this provision",
  "keywords": ["The 5-7 most important words to remember"],
  "onePageRevision": {
    "provisionInOneLinex": "The entire provision in one clear sentence",
    "threeKeyPoints": ["Point 1", "Point 2", "Point 3"],
    "oneCase": "One must-know case",
    "oneException": "The most important exception",
    "examTip": "What examiners specifically look for"
  },
  "commonErrors": ["Mistake students commonly make about this provision"],
  "professorNote": "The professor's personal memory tip",
  "socraticQuestion": "Can you explain this provision to a first-year student in 3 sentences?"
}`,

      12: `You are teaching STEP 12: Examination Preparation.

Provision: "${provisionText}"
Act: ${actName}, ${sectionRef}
Session so far: ${sessionContext}

Return JSON:
{
  "stepTitle": "Step 12: Exam Preparation",
  "professorIntro": "2 sentences on examination strategy",
  "universityQuestions": [
    { "question": "5-mark or 10-mark university exam question", "type": "Short/Long", "modelAnswerOutline": ["Point 1", "Point 2", "Point 3"] }
  ],
  "judiciaryQuestions": [
    { "question": "Judiciary exam style question", "type": "Essay/Problem", "modelAnswerOutline": ["Point 1", "Point 2"] }
  ],
  "problemQuestions": [
    { "problem": "A legal problem question with facts", "issueIdentification": "The legal issues", "applicableLaw": "The relevant provision", "analysis": "How to apply the law", "conclusion": "The answer" }
  ],
  "viva": ["Typical viva question 1", "Typical viva question 2", "Typical viva question 3"],
  "examStrategy": "How to write a high-scoring answer on this provision",
  "professorNote": "Most frequently asked question on this provision in the last 10 years",
  "socraticQuestion": "Try answering this in 5 minutes: [one of the questions above]"
}`,

      13: `You are conducting STEP 13: Interactive Quiz.

Provision: "${provisionText}"
Act: ${actName}, ${sectionRef}
Session so far: ${sessionContext}
User's quiz answer: "${body.quizAnswer || 'Not answered yet'}"

Return JSON:
{
  "stepTitle": "Step 13: Knowledge Check",
  "professorIntro": "2 sentences setting up the quiz with encouragement",
  "quiz": [
    {
      "questionNumber": 1,
      "type": "MCQ",
      "question": "Question about this specific provision",
      "options": ["A. Option", "B. Option", "C. Option", "D. Option"],
      "correctAnswer": "B",
      "explanation": "Why this is correct and why others are wrong"
    },
    {
      "questionNumber": 2,
      "type": "True/False",
      "question": "A statement about this provision",
      "correctAnswer": "True/False",
      "explanation": "Explanation with reference to the provision"
    },
    {
      "questionNumber": 3,
      "type": "Fill in the Blank",
      "question": "The provision states that ____.",
      "correctAnswer": "The exact word(s)",
      "explanation": "Why these words matter"
    },
    {
      "questionNumber": 4,
      "type": "Short Answer",
      "question": "A conceptual question requiring a 2-3 sentence answer",
      "modelAnswer": "The expected answer",
      "keyPoints": ["Must mention this", "Must mention that"]
    }
  ],
  "professorEncouragement": "A motivating message from the professor"
}`,

      14: `You are at STEP 14: Understanding Check and Re-teaching if needed.

Provision: "${provisionText}"
Act: ${actName}, ${sectionRef}
Session so far: ${sessionContext}
Student message: "${userMessage || 'Student has not responded yet'}"

Assess whether the student seems to understand. If they say No or seem confused, provide a completely different teaching approach.

Return JSON:
{
  "stepTitle": "Step 14: Understanding Check",
  "understandingCheck": "Did the student indicate understanding? YES/NO/UNCLEAR",
  "professorResponse": "A personal, warm response from the professor to the student",
  "alternateExplanation": "If student is confused: Teach the SAME provision using a completely different analogy, metaphor, or approach. If understood: Affirm and add a bonus insight.",
  "simpleAnalogy": "The simplest possible analogy for this provision (something from everyday life)",
  "encouragement": "A motivating message from the professor",
  "socraticQuestion": "One final question to test true understanding"
}`,

      15: `You are generating STEP 15: Final Mastery Report.

Provision: "${provisionText}"
Act: ${actName}, ${sectionRef}
Session so far: ${sessionContext}

Return JSON:
{
  "stepTitle": "Step 15: Mastery Report",
  "professorClosing": "A warm, encouraging closing message from the professor to the student",
  "masterySummary": {
    "provisionMastered": "${sectionRef} of ${actName}",
    "conceptsCovered": ["Concept 1", "Concept 2", "Concept 3", "Concept 4", "Concept 5"],
    "strengthAreas": ["What the student should know well after this session"],
    "revisionSuggestions": ["What to review before an exam"]
  },
  "relatedProvisions": [
    { "provision": "Section/Article", "act": "Act name", "connection": "How it relates" }
  ],
  "relatedConstitutionalArticles": [
    { "article": "Article number", "connection": "How it connects" }
  ],
  "relatedDoctrines": [
    { "doctrine": "Legal doctrine", "relevance": "How it applies" }
  ],
  "mustKnowCases": [
    { "case": "Case name and citation if known", "why": "Why it's essential for exams" }
  ],
  "finalExamNote": "One crucial tip for examinations",
  "professorSignoff": "A personalized sign-off from Professor LexMentor"
}`,
    };

    const actionPrompts: Record<string, string> = {
      doubt: `The student has asked a doubt DURING the teaching session.
Current Step: ${step}
Provision: "${provisionText}"
Act: ${actName}, ${sectionRef}
Session so far: ${sessionContext}
Student's doubt: "${userMessage}"

Return JSON:
{
  "type": "doubt_response",
  "professorAcknowledgement": "Acknowledge the doubt warmly — 'Excellent question!' or 'That is precisely where most students get confused...'",
  "answer": "A thorough, scholarly answer to the doubt with examples if needed",
  "relatedConcept": "How this connects to the broader provision",
  "continuationCue": "A sentence indicating the lesson will now continue from where it paused",
  "stepToResume": ${step}
}`,

      example: `The student has asked for another example at Step ${step}.
Provision: "${provisionText}"
Act: ${actName}, ${sectionRef}
Return JSON:
{
  "type": "extra_example",
  "example": { "scenario": "A fresh example not previously given", "analysis": "How the provision applies", "outcome": "Legal result" },
  "professorNote": "Insight from this example"
}`,

      simpler: `The student wants a simpler explanation at Step ${step}.
Provision: "${provisionText}"
Act: ${actName}, ${sectionRef}
Session so far: ${sessionContext}
Return JSON:
{
  "type": "simpler_explanation",
  "analogy": "The simplest possible analogy from everyday life",
  "explanation": "Re-explain this step using class 8 level language while keeping legal accuracy",
  "keyTakeaway": "One sentence summary",
  "readyToMoveOn": "An encouraging phrase to continue"
}`,

      deeper: `The student wants a deeper explanation at Step ${step}.
Provision: "${provisionText}"
Act: ${actName}, ${sectionRef}
Session so far: ${sessionContext}
Return JSON:
{
  "type": "deeper_explanation",
  "advancedAnalysis": "A PhD-level analysis of this step — academic debates, minority views, comparative law, scholarly critique",
  "caseDeepDive": "One detailed case analysis if available",
  "legislativeHistory": "Any additional legislative history details",
  "academicReferences": "Scholars or commentaries that discuss this (Mulla, Ratanlal, Sarkar, etc.)",
  "criticalQuestion": "A research-level question to probe further"
}`,

      court: `The student wants the court's view at Step ${step}.
Provision: "${provisionText}"
Act: ${actName}, ${sectionRef}
Return JSON:
{
  "type": "court_view",
  "judicialSummary": "How Indian courts have broadly treated this provision",
  "keyRuling": "The most important judicial ruling if known (cite honestly)",
  "interpretationTrend": "Strict vs liberal vs purposive — which way are courts going?",
  "advocateAngle": "What lawyers argue in court regarding this"
}`,

      exam: `The student wants the exam angle at Step ${step}.
Provision: "${provisionText}"
Act: ${actName}, ${sectionRef}
Return JSON:
{
  "type": "exam_view",
  "expectedQuestion": "Most likely exam question on this step's content",
  "modelAnswer": "A model 10-mark answer",
  "keywordsToDrop": ["Word 1", "Word 2", "Word 3"],
  "timingTip": "How many minutes to spend, what to cover first"
}`,
    };

    const prompt = action === 'teach'
      ? stepPrompts[step] || stepPrompts[1]
      : actionPrompts[action] || stepPrompts[step];

    const fallback = {
      stepTitle: `Step ${step}`,
      professorIntro: `Welcome to Step ${step} of our study of ${sectionRef}.`,
      content: `Professor is offline. Please check your connection and try again.`,
      originalText: provisionText,
      provider: 'local-fallback',
    };

    let result: any = fallback;
    try {
      const completion = await this.ai.complete({
        userId,
        module: 'research',
        temperature: 0.2,
        maxTokens: 3500,
        jsonMode: true,
        messages: [
          { role: 'system', content: PROFESSOR_SYSTEM },
          { role: 'user', content: prompt },
        ],
      });
      result = {
        ...tryParseJson(completion.content, fallback),
        provider: completion.provider,
        model: completion.model,
        step,
        action,
      };
    } catch {
      result.provider = 'local-fallback';
    }
    return result;
  }

  private localExplainBareAct(act: string, chapter: string, part: string, section: string) {
    return {
      purpose: `Section/Article ${section} of the ${act} is designed to establish structured legal governance parameters, addressing ambiguities in local jurisdictions and defining compliance standards.`,
      importantKeywords: [
        { word: 'Statutory Obligation', explanation: 'A duty imposed directly by a legislative act or statute.' },
        { word: 'Jurisdiction', explanation: 'The official power to make legal decisions and judgments.' }
      ],
      legislativeIntent: 'The primary legislative objective is to ensure judicial clarity, preventing narrow literal interpretations that defeat the remedial scope of the Act.',
      commonMistakes: [
        { mistake: 'Literal Over-interpretation', explanation: 'Ignoring legislative context or saving provisos, leading to incorrect legal conclusions.' }
      ],
      memoryTricks: [
        `Associate Section ${section} with its primary keyword: 'Governance'.`
      ],
      realLifeIllustrations: [
        'A public officer acting in good faith under this section is shielded from personal liability for administrative errors.'
      ],
      landmarkJudgments: [
        { caseName: 'State of U.P. v. Mohammad Nooh', citation: '1958 SCR 595', ratio: 'Constitutional writ powers are not limited by alternate administrative sorting procedures.' }
      ],
      relatedProvisions: [
        { provision: 'Article 226', relationship: 'Provides constitutional backing for challenging statutory authority decisions.' }
      ],
      examQuestions: [
        `Explain the legislative history and constitutional validity of Section ${section}.`
      ],
      mootCourtRelevance: 'Can be cited to dispute procedural maintainability or show statutory compliance by state organs.',
      lawyerTips: [
        'Always check the state amendments to this section, as stamp duty and filing thresholds vary by jurisdiction.'
      ],
      provider: 'local-fallback'
    };
  }

  private localSimplifyBareAct(act: string, chapter: string, section: string, clause: string) {
    return {
      oneLineSummary: `Establishes the primary statutory duties, rules, and procedures for Section ${section} of the ${act}.`,
      originalText: `Section ${section} (${clause || 'General'}): All competent authorities shall comply with standard procedures, subject to local jurisdictional amendments.`,
      plainEnglishText: `Under Section ${section}, government bodies and officers must follow standard steps when executing their duties.`,
      detailedExplanation: 'This section details who can exercise administrative power, the step-by-step procedures required, and what exceptions apply.',
      visualFlowText: 'Step 1: Check Section Applicability -> Step 2: File Petition -> Step 3: Authority Review -> Step 4: Decision',
      keyPoints: [
        'Applies to all public authorities.',
        'Requires written notice before enforcement action.'
      ],
      exceptions: [
        'Does not apply during declared public emergencies.'
      ],
      caseLaws: [
        { caseName: 'L. Chandra Kumar v. Union of India', principle: 'Judicial review under Articles 226/32 is part of the basic structure of the Constitution.' }
      ],
      relatedSections: ['Section 2 (Definitions)', 'Section 14 (Appeals)'],
      importantLegalTerms: [
        { term: 'Ultra Vires', definition: 'Beyond one\'s legal power or authority.' }
      ],
      examNotes: [
        'Focus on the procedural exceptions, as they are frequently tested in Judicial Services examinations.'
      ],
      faqs: [
        { question: 'Is compliance with this section mandatory?', answer: 'Yes, the word "shall" indicates that compliance is absolute and mandatory.' }
      ],
      provider: 'local-fallback'
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BARE ACT AI — INTELLIGENT STATUTORY ASSISTANT
  // ═══════════════════════════════════════════════════════════════════════════

  private static readonly BARE_ACT_STYLES = ['Law Professor', 'Judiciary Faculty', 'Senior Advocate', 'Practical Courtroom', 'Law School Classroom'] as const;

  // ── Dynamic teaching-style detection (question-driven, never changes legal content) ──
  private detectBareActTeachingStyle(
    input: string,
    history?: { role: 'user' | 'assistant'; content: string }[],
  ): typeof LegalIntelligenceService.BARE_ACT_STYLES[number] {
    const recentTurns = (history || []).slice(-2).map(h => h.content).join(' ');
    const signal = `${input} ${recentTurns}`.toLowerCase();

    if (/\b(judiciary exam|pcs-?j|judicial services|mains exam|prelims|mnemonic|exam trap|important for (the )?exam)\b/.test(signal)) {
      return 'Judiciary Faculty';
    }
    if (/\b(in practice|how do i file|draft(ing)? a|real case|procedure|cognizance|what happens in court|filing a)\b/.test(signal)) {
      return 'Practical Courtroom';
    }
    if (/\b(argue|before a bench|as an advocate|as a lawyer|counsel|opposing (side|counsel)|cross-examin|litigation strategy)\b/.test(signal)) {
      return 'Senior Advocate';
    }
    if (/\b(difference between|\bvs\.?\b|why does the law|does this apply if|what if the)\b/.test(signal)) {
      return 'Law School Classroom';
    }
    return 'Law Professor';
  }

  private buildBareActStyleFragment(style: string): string {
    const styles: Record<string, string> = {
      'Law Professor': 'Speak as a measured, structured senior law professor -- build intuition before naming the rule, patient with fundamentals.',
      'Law School Classroom': 'Speak as if leading a Socratic law-school discussion -- pose the puzzle or tension in the provision before resolving it, think out loud with the student rather than announcing conclusions.',
      'Senior Advocate': 'Speak as a senior advocate briefing a junior -- frame the provision in terms of how it would actually be invoked or argued before a court, direct and economical.',
      'Judiciary Faculty': 'Speak as a judiciary-exam coaching faculty member -- brisk, comparison-heavy, foreground commonly confused distinctions and exam traps.',
      'Practical Courtroom': 'Speak from courtroom practice -- ground the explanation in how this provision plays out procedurally in a real matter, not abstract theory.',
    };
    return styles[style] || styles['Law Professor'];
  }

  // ── Modular prompt builders -- each owns exactly one concern, assembled below ──
  private buildBareActIdentityFragment(): string {
    return `You are LEGATRIXON -- an expert AI law professor specialising in Indian statutory law.
You know the BNS (Bharatiya Nyaya Sanhita 2023), BNSS (Bharatiya Nagarik Suraksha Sanhita 2023), BSA (Bharatiya Sakshya Adhiniyam 2023), Constitution of India, IPC, CrPC, Indian Evidence Act, and all major Indian Acts thoroughly.

Your personality: a brilliant senior law professor who genuinely loves teaching.`;
  }

  private buildBareActRetrievedContextFragment(
    hasCorpus: boolean,
    corpusContext: string,
    detectedActFull: string,
    provisionLabel: string,
    provisionNumber: string | null,
    topScore: number,
  ): string {
    return `======= RETRIEVED CONTEXT FROM INDEXED BARE ACTS =======
${hasCorpus ? corpusContext : 'No corpus match found. Use your expert legal knowledge. Flag uncertain section numbers or punishments with WARNING.'}

======= QUERY METADATA =======
Detected Act   : ${detectedActFull}
${provisionNumber ? `Provision      : ${provisionLabel} ${provisionNumber}` : 'Query Type     : General legal concept / pasted provision'}
Retrieval Score: ${hasCorpus ? `${(topScore * 100).toFixed(0)}% confidence` : 'No corpus hit -- knowledge mode'}`;
  }

  private buildBareActConversationContextFragment(hasHistory: boolean): string {
    return `======= CONVERSATION CONTINUITY =======
${hasHistory
    ? 'This is a follow-up in an ongoing discussion. Resolve pronouns and short follow-ups (e.g. "give an example", "what about the exceptions", "what is X?") against what was already discussed above -- do not repeat an explanation already given in full; refer back to it briefly and add only what is genuinely new.'
    : 'This is the first question in the conversation -- there is no prior context to build on.'}`;
  }

  private buildBareActResponseValidationFragment(): string {
    return `======= RESPONSE RULES (NON-NEGOTIABLE) =======
1. GROUNDING: When corpus text is available above, quote it exactly. Build your explanation FROM that text.
2. KNOWLEDGE MODE: When corpus text is unavailable, use your comprehensive legal knowledge -- but flag uncertain specifics with a WARNING prefix.
3. NEVER fabricate: section numbers, punishments, dates, or case citations you are not certain of. If you are not confident about a citation, say so plainly instead of inventing one.
4. If the user pasted a provision, treat that text as the authoritative source.
5. Maintain conversation context -- if the user asks a follow-up like "give an example" or "compare with IPC", answer in the context of what was previously discussed.
6. NEVER refuse to answer. Always give the most helpful response possible within these rules.`;
  }

  private buildBareActTeachingMethodologyFragment(): string {
    return `======= HOW TO TEACH (NOT DEFINE) =======
You are not producing a reference entry -- you are standing in front of first-year students meeting this provision for the first time. A dictionary states a rule; you earn it. Before you name a legal concept, doctrine, or Latin term, first explain the everyday problem or idea behind it in plain words a beginner would already understand -- only once that idea is on the table do you attach its legal name to it. Never introduce a technical term and then explain it after the fact.

Weave your examples into the explanation as you go, at the moment they are useful -- not as a separate "Example:" block bolted onto the end.

As you teach, make sure the following actually gets covered -- but let it emerge as the natural shape of an explanation, not as a checklist the reader can see:
- What the provision actually says, in the students' own words
- Why a provision like this exists / what problem it solves
- Each of its working parts, one at a time, in the order that helps understanding
- Difficult legal terms, explained in plain language before being named
- Who and what it applies to, and what happens if it is violated
- 2-3 concrete, natural hypothetical examples
- Important exceptions, provisos, or saving clauses
- Related provisions that connect to this section
- Comparison with the old IPC/CrPC/IEA provision, when discussing BNS/BNSS/BSA
- Landmark judicial interpretation -- only if you are certain; skip it plainly if not
- A quick exam note / memory trick where useful`;
  }

  private buildBareActResponseStructureFragment(): string {
    return `======= RESPONSE STYLE =======
- Write the way you'd actually speak explaining this to a room of students -- not the way a statute or judgment reads. Avoid stiff, bureaucratic phrasing ("it is hereby provided that", "the aforementioned provision", "pursuant to"); use plain, direct sentences, contractions where natural, and the occasional rhetorical question.
- NOT like a form, dashboard, or rigid template.
- Use markdown headings (## and ###) and bullet points, but keep the prose natural and continuous.
- Adapt length intelligently:
    Simple definition question -> 3-4 focused paragraphs
    Full section analysis -> comprehensive explanation covering all sub-topics
    Comparison question -> clear structured comparison
    Follow-up question -> direct contextual answer, no repetition

======= END EVERY RESPONSE WITH =======
---
**You may also want to know:**
- [Follow-up question 1 -- the next logical thing a student would ask]
- [Follow-up question 2 -- goes deeper into this specific provision]
- [Follow-up question 3 -- related provision or IPC/CrPC comparison]`;
  }

  private buildBareActTerminologyFragment(): string {
    return `======= LEGAL TERMINOLOGY =======
Whenever you use a legal term, Latin maxim, or word with a specific statutory/judicial meaning, define it immediately and naturally the first time it appears -- e.g. "cognizable offence (an offence where police can arrest without a court warrant)". Do this automatically, without being asked, every time such a term appears -- but do not re-define a term you have already defined earlier in the same answer or earlier in this conversation.`;
  }

  private assembleBareActSystemPrompt(fragments: {
    identity: string;
    retrievedContext: string;
    conversationContext: string;
    responseValidation: string;
    teachingMethodology: string;
    responseStructure: string;
    terminology: string;
    style: string;
  }): string {
    return [
      fragments.identity,
      '',
      `======= TEACHING VOICE FOR THIS RESPONSE =======\n${fragments.style}`,
      '',
      fragments.retrievedContext,
      '',
      fragments.conversationContext,
      '',
      fragments.responseValidation,
      '',
      fragments.teachingMethodology,
      '',
      fragments.terminology,
      '',
      fragments.responseStructure,
    ].join('\n');
  }

  private buildBareActExtractiveFallbackPrompt(corpusContext: string, detectedActFull: string): string {
    return `You are organizing verified statutory text into a clear, structured explanation. You are in a constrained fallback mode -- work ONLY from the text below. Do not introduce case law, legislative history, or any claim not directly supported by this text.

======= VERIFIED TEXT =======
${corpusContext}

======= DETECTED ACT =======
${detectedActFull}

======= INSTRUCTIONS =======
You MUST structure your response EXACTLY as follows, using the exact headers specified below. Do not deviate from this format under any circumstances:

## Provision
${detectedActFull}
[Section Number/Article Number]
[Section Title/Article Title]
---
## Original Bare Act Text
[Quote the relevant provision text exactly as stored]
---
## Simple Explanation
[A simple explanation based only on the verified text above, without any external details or assumptions]
---
## Clause-wise Breakdown
[Explain each clause of the provision separately, based only on the verified text above]
---
## Important Legal Terms
[Explain difficult statutory words from the verified text above]
---
## Related Sections
[Show related sections ONLY if they are explicitly mentioned in the verified text above. If none, leave this section empty.]
---
## Source
${detectedActFull}
[Section Number/Article Number]
LEGATRIXON Database`;
  }

  private buildBareActTemplateExplanation(
    hits: Array<{ score: number; text: string; actName: string; shortName: string; section: string | null }>,
    detectedActFull: string,
    provisionLabel: string,
    provisionNumber: string | null,
  ): string {
    const top = hits.slice(0, 5);
    const sectionText = top
      .map((h) => h.text)
      .join('\n\n---\n\n') || 'No verified statutory text available.';
    const sectionTitle = top[0]?.section ? `${provisionLabel} ${top[0].section}` : 'General Statutory Provision';

    return `## Provision
${detectedActFull}
${provisionLabel} ${provisionNumber || 'General'}
${sectionTitle}
---
## Original Bare Act Text
${sectionText}
---
## Simple Explanation
An automated explanation is not available at this moment. Please refer to the original text above.
---
## Clause-wise Breakdown
An automated breakdown is not available at this moment. Please refer to the original text above.
---
## Important Legal Terms
An automated breakdown is not available at this moment. Please refer to the original text above.
---
## Related Sections

---
## Source
${detectedActFull}
${provisionLabel} ${provisionNumber || 'General'}
LEGATRIXON Database`;
  }

  // Generation with graceful degradation: retry -> alternate provider -> extractive -> template ──
  private async bareActGenerateWithDegradation(
    systemPrompt: string,
    extractiveSystemPrompt: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    provisionText: string,
    hasCorpus: boolean,
    hits: Array<{ score: number; text: string; actName: string; shortName: string; section: string | null }>,
    detectedActFull: string,
    provisionLabel: string,
    provisionNumber: string | null,
  ): Promise<{ markdown: string; degraded: boolean; stage: 'primary' | 'retry' | 'extractive' | 'template' | 'exhausted' }> {
    const baseMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...history,
      { role: 'user' as const, content: provisionText },
    ];

    // Attempt 1: primary generation
    try {
      const completion = await this.ai.complete({
        module: 'research',
        temperature: 0.0,
        topP: 0.1,
        maxTokens: 4000,
        timeoutMs: 90000,
        jsonMode: false,
        messages: baseMessages,
      });
      if (completion.content?.trim()) {
        return { markdown: completion.content, degraded: false, stage: 'primary' };
      }
      throw new Error('Empty response from AI provider');
    } catch (err: any) {
      this.logger.warn(`BareActAI generation attempt 1 (primary) failed: ${err?.message}`);
    }

    // Attempt 2: retry, forcing a different provider to the front of the fan-out order
    try {
      const completion = await this.ai.complete({
        module: 'research',
        temperature: 0.0,
        topP: 0.1,
        maxTokens: 4000,
        timeoutMs: 60000,
        jsonMode: false,
        preferredModel: 'GPT-4o-Mini',
        messages: baseMessages,
      });
      if (completion.content?.trim()) {
        return { markdown: completion.content, degraded: false, stage: 'retry' };
      }
      throw new Error('Empty response from AI provider on retry');
    } catch (err: any) {
      this.logger.warn(`BareActAI generation attempt 2 (alternate provider) failed: ${err?.message}`);
    }

    // Both generation attempts exhausted -- no verified text to fall back to either
    if (!hasCorpus) {
      return {
        markdown: 'I could not find the requested provision in the available Bare Act database.',
        degraded: true,
        stage: 'exhausted',
      };
    }

    // Attempt 3: one lighter, extractive-only generation grounded strictly in retrieved text
    try {
      const completion = await this.ai.complete({
        module: 'research',
        temperature: 0.0,
        topP: 0.1,
        maxTokens: 1500,
        timeoutMs: 30000,
        jsonMode: false,
        messages: [
          { role: 'system', content: extractiveSystemPrompt },
          { role: 'user', content: provisionText },
        ],
      });
      if (completion.content?.trim()) {
        return { markdown: completion.content, degraded: true, stage: 'extractive' };
      }
    } catch (err: any) {
      this.logger.warn(`BareActAI extractive fallback generation failed: ${err?.message}`);
    }

    // Final, dependency-free floor: deterministic template built only from verified retrieved text
    return {
      markdown: 'I could not find the requested provision in the available Bare Act database.',
      degraded: true,
      stage: 'template',
    };
  }

  // ── Main professor chat handler (redesigned: strict single-Act retrieval priority) ──
  async professorChat(
    userId: string,
    body: {
      userInput: string;
      history?: { role: 'user' | 'assistant'; content: string }[];
    },
  ) {
    void userId;
    const userInput = String(body.userInput || '').trim();
    if (!userInput) {
      return { response: 'Please type a legal question or section reference.', act: 'UNKNOWN', source: 'none', lowConfidence: false };
    }

    // 1. Check for Greetings
    if (this.isBareActGreeting(userInput)) {
      const greetingResponse = `Hello! I am **Bare Act AI**, your statutory law assistant inside LEGATRIXON.\n\nI help you understand Bare Acts in simple language while preserving their legal meaning.\n\nI can explain:\n\n• Sections\n• Definitions\n• Clauses\n• Provisos\n• Explanations\n• Illustrations\n• Exceptions\n• Chapters\n• Schedules\n• Legal terminology used inside Bare Acts\n\nI answer only from the Bare Act database available in LEGATRIXON and do not provide legal opinions or case-based advice.\n\nHow can I help you today?`;
      return {
        response: greetingResponse,
        act: 'WELCOME',
        source: 'none',
        lowConfidence: false,
      };
    }

    // 2. Check for out-of-scope questions
    const normalizedQuery = userInput.toLowerCase();
    const isWinCase = /\b(win|outcome|lose|verdict|judge\s+will|court\s+outcome|predict|succeed\s+in)\b/i.test(normalizedQuery) && /\b(case|suit|matter|trial|appeal|litigation)\b/i.test(normalizedQuery);
    const isLegalAdvice = /\b(what\s+should\s+i\s+do|how\s+should\s+i|legal\s+strategy|legal\s+advice|should\s+i\s+file|recommend\s+filing|draft\s+a)\b/i.test(normalizedQuery);
    const isCaseLawQuery = /\b(case\s+law|precedent|judgment|judgement|ruling|supreme\s+court|high\s+court|landmark\s+case)\b/i.test(normalizedQuery);
    const isDraftingQuery = /\b(draft|write\s+a\s+contract|template\s+for|agreement\s+draft)\b/i.test(normalizedQuery);
    const isConstitutionalPhilosophy = /\b(philosophy|philosophical|foundation|origin|evolution|concept\s+of\s+equality|concept\s+of\s+justice)\b/i.test(normalizedQuery) && /\b(constitution|constitutional|equality|justice)\b/i.test(normalizedQuery);

    if (isWinCase) {
      return {
        response: `I specialize only in explaining Bare Act provisions. I cannot provide legal advice or predict legal outcomes. If you would like to understand a specific statutory provision, please mention the Act and Section.`,
        act: 'OUT_OF_SCOPE',
        source: 'none',
        lowConfidence: false,
      };
    }

    if (isLegalAdvice) {
      return {
        response: `My role is limited to explaining statutory provisions contained in Bare Acts. I cannot provide legal advice or recommendations.`,
        act: 'OUT_OF_SCOPE',
        source: 'none',
        lowConfidence: false,
      };
    }

    if (isCaseLawQuery) {
      return {
        response: `I specialize only in explaining Bare Act provisions. I cannot discuss case laws, precedents, or judgments. If you would like to understand a specific statutory provision, please mention the Act and Section.`,
        act: 'OUT_OF_SCOPE',
        source: 'none',
        lowConfidence: false,
      };
    }

    if (isDraftingQuery) {
      return {
        response: `I specialize only in explaining Bare Act provisions. I cannot draft legal documents. If you would like to understand a specific statutory provision, please mention the Act and Section.`,
        act: 'OUT_OF_SCOPE',
        source: 'none',
        lowConfidence: false,
      };
    }

    if (isConstitutionalPhilosophy) {
      return {
        response: `I specialize only in explaining Bare Act provisions. I cannot discuss general constitutional philosophy unless directly supported by the Bare Act text. If you would like to understand a specific statutory provision, please mention the Act and Section.`,
        act: 'OUT_OF_SCOPE',
        source: 'none',
        lowConfidence: false,
      };
    }

    // 3. Retrieval First Architecture
    const retrieval = await this.legalRetrievalService.retrieveLegalContext(userInput, 10);
    const requestedActId = retrieval.detectedActId;
    const mismatched = requestedActId
      ? retrieval.provisions.some((provision) => provision.actId !== requestedActId)
      : false;

    if (mismatched || !retrieval.provisions || retrieval.provisions.length === 0 || (requestedActId && retrieval.detectedNumber && retrieval.provisions.length === 0)) {
      return {
        response: 'I could not find the requested provision in the available Bare Act database.',
        act: retrieval.detectedActName || 'UNKNOWN',
        source: 'none',
        lowConfidence: true,
      };
    }

    const orderedHits = retrieval.provisions.map((provision) => ({
      score: provision.score,
      text: provision.content,
      actName: provision.actName,
      shortName: retrieval.detectedActName || provision.actName,
      section: provision.section || null,
    }));

    const detectedActFull = retrieval.detectedActName || orderedHits[0]?.actName || 'Indian Law';
    const detectedActShort = detectedActFull.replace(/, \d{4}$/, '').substring(0, 32) || 'UNKNOWN';
    const provisionNumber = retrieval.detectedNumber;
    const provisionLabel = retrieval.detectedType === 'article' ? 'Article' : 'Section';
    const corpusContext = orderedHits.length > 0
      ? orderedHits.map((h, i) => {
          const label = h.score === 1 ? 'exact SQL match' : `similarity ${(h.score * 100).toFixed(0)}%`;
          return `[${i + 1}] ${h.actName} | ${h.section ? `${provisionLabel} ${h.section}` : 'General'} | ${label}\n${h.text}`;
        }).join('\n\n---\n\n')
      : '';

    const hasCorpus = corpusContext.length > 0;
    const source: 'corpus' | 'knowledge' | 'hybrid' = hasCorpus && retrieval.log.strategy === 'exact-sql' ? 'corpus' : hasCorpus ? 'hybrid' : 'knowledge';

    // 4. Strict Retrieval Grounding System Prompt
    const systemPrompt = 
      `You are Bare Act AI, a specialized statutory law assistant inside LEGATRIXON. Your only responsibility is helping users understand Bare Acts exactly as they are written.\n\n` +
      `ROLE AND BEHAVIOR:\n` +
      `- You are NOT a general legal assistant, chatbot, or research assistant.\n` +
      `- You make statutory provisions easy to understand without changing their legal meaning.\n` +
      `- You answer ONLY from the provided retrieved statutory text below.\n` +
      `- Every sentence you generate must be supported by the retrieved statutory text. Do not invent, assume, or infer anything. No creativity, speculation, or assumptions are allowed.\n` +
      `- NEVER discuss case laws, Supreme Court or High Court judgments, legal opinions, precedents, or legal strategies.\n` +
      `- Do not provide legal advice, do not predict court outcomes, do not suggest legal strategy, do not recommend filing cases, do not interpret evidence, and do not draft legal documents.\n` +
      `- Previous conversation memory is restricted. You must NOT use previous conversation memory or general LLM knowledge to answer. Answer ONLY from the retrieved statutory context provided in the current prompt.\n` +
      `- If the answer is not present inside the retrieved Bare Act text, you must return: 'I could not find the requested provision in the available Bare Act database.'\n\n` +
      `RETRIEVED STATUTORY CONTEXT:\n` +
      `${corpusContext}\n\n` +
      `RESPONSE FORMAT:\n` +
      `You MUST structure your response EXACTLY as follows, using the exact headers specified below. Do not deviate from this format under any circumstances:\n\n` +
      `## Provision\n` +
      `${detectedActFull}\n` +
      `${provisionLabel} ${provisionNumber || 'General'}\n` +
      `${orderedHits[0]?.section ? `Section ${orderedHits[0].section}` : 'General Statutory Provision'}\n` +
      `---\n` +
      `## Original Bare Act Text\n` +
      `${orderedHits[0]?.text || 'No original text available.'}\n` +
      `---\n` +
      `## Simple Explanation\n` +
      `[Rewrite the provision in plain English without changing its legal meaning, strictly grounded in the retrieved text]\n` +
      `---\n` +
      `## Clause-wise Breakdown\n` +
      `[Explain each clause of the provision separately, strictly based on the retrieved text]\n` +
      `---\n` +
      `## Important Legal Terms\n` +
      `[Explain difficult statutory words present in the provision]\n` +
      `---\n` +
      `## Related Sections\n` +
      `[Show related sections ONLY if they are present and retrieved in the provided statutory context. NEVER invent or search for related sections from memory. If no related sections are in the retrieved context, leave this section empty or omit it.]\n` +
      `---\n` +
      `## Source\n` +
      `${detectedActFull}\n` +
      `${provisionLabel} ${provisionNumber || 'General'}\n` +
      `LEGATRIXON Database`;

    const extractiveSystemPrompt = this.buildBareActExtractiveFallbackPrompt(corpusContext, detectedActFull);
    const history = Array.isArray(body.history)
      ? body.history.slice(-8).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      : [];

    const result = await this.bareActGenerateWithDegradation(
      systemPrompt,
      extractiveSystemPrompt,
      history,
      userInput,
      hasCorpus,
      orderedHits,
      detectedActFull,
      provisionLabel,
      provisionNumber,
    );

    const lowConfidence = !hasCorpus || retrieval.log.confidence === 'low' || retrieval.log.confidence === 'none' || (result.degraded && retrieval.log.confidence !== 'high');

    return { response: result.markdown, act: detectedActShort, source, lowConfidence };
  }


  // ──────────────────────────────────────────────────────────────────────────

  async analyzeCaseReasoning(userId: string, body: { caseNameOrProblem: string; studentSolution: string }) {
    const caseNameOrProblem = String(body.caseNameOrProblem || '').trim();
    const studentSolution = String(body.studentSolution || '').trim();

    if (!caseNameOrProblem || !studentSolution) {
      throw new BadRequestException('Case Name/Problem and Student Solution are required.');
    }

    const cacheKey = `case-sim-analyze:${caseNameOrProblem.substring(0, 50)}:${studentSolution.substring(0, 50)}`;
    const cached = await this.cache.get('research', cacheKey, userId);
    if (cached) {
      const saved = this.sessionRepo.create({
        userId,
        caseName: caseNameOrProblem,
        studentAnswers: studentSolution,
        evaluationResult: cached,
        status: 'evaluated',
      });
      await this.sessionRepo.save(saved);
      return cached;
    }

    const fallback = this.localAnalyzeCase(caseNameOrProblem, studentSolution);
    let result = fallback;

    try {
      const prompt = `You are a senior law professor reviewing a student's answer/solution to a legal case.
Case Name or Factual Problem: "${caseNameOrProblem}"
Student's Proposed Solution:
"${studentSolution}"

Conduct a rigorous, professional analysis of the student's legal reasoning. Do NOT simply state the final holding; focus on teaching correct analytical methods.
Conform strictly to this JSON schema:

{
  "understandingOfFacts": "Critique of the student's grasp of material facts.",
  "issueIdentification": "Critique of the student's ability to isolate the core legal questions.",
  "bareActAnalysis": "Critique of the statutory provisions, articles, or sections referenced or missed.",
  "caseLawAnalysis": "Critique of the precedents, citations, or case laws referenced or missed.",
  "legalReasoningAnalysis": "A deep analysis of the logical reasoning, checking for fallacies or gaps in IRAC application.",
  "simplifiedExplanation": "A plain-English, simplified summary of how the case is actually analyzed by senior jurists.",
  "mistakesMade": ["Mistake 1", "Mistake 2"],
  "betterWayToSolve": "A step-by-step guidance on how to properly solve this problem in practice.",
  "modelAnswer": "A professional model answer showcasing how a senior advocate or judge would draft the solution.",
  "learningTips": ["Tip 1", "Tip 2"],
  "scores": {
    "overallScore": 75,
    "factRecall": 80,
    "issueSpotting": 70,
    "statutoryApplication": 85,
    "precedentUsage": 60,
    "analyticalLogic": 80
  },
  "professorComments": "Personalized comments in the voice of a senior law professor grading the student."
}`;

      const completion = await this.ai.complete({
        userId,
        module: 'research',
        temperature: 0.2,
        maxTokens: 3200,
        jsonMode: true,
        messages: [
          {
            role: 'system',
            content: 'You are an elite senior law professor grading a student\'s legal response. Be constructive, strict, highly academic, and encouraging. Return valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const parsed = tryParseJson(completion.content, null);
      if (parsed && parsed.understandingOfFacts && parsed.scores) {
        result = { ...fallback, ...parsed, provider: completion.provider };
      }
    } catch (err) {
      console.error('Failed to run AI case simulation analysis, using fallback:', err);
    }

    await this.cache.set('research', cacheKey, result, { feature: 'case-simulator-analyze' });

    const saved = this.sessionRepo.create({
      userId,
      caseName: caseNameOrProblem,
      studentAnswers: studentSolution,
      evaluationResult: result,
      status: 'evaluated',
    });
    await this.sessionRepo.save(saved);

    return result;
  }

  private localAnalyzeCase(caseNameOrProblem: string, studentSolution: string) {
    const inputLower = caseNameOrProblem.toLowerCase();
    
    // Dynamic score based on length
    const scoreVal = Math.min(100, Math.max(35, Math.round(studentSolution.length / 5 + 40)));
    
    const scores = {
      overallScore: scoreVal,
      factRecall: Math.min(100, Math.round(scoreVal * 1.05)),
      issueSpotting: Math.min(100, Math.round(scoreVal * 0.98)),
      statutoryApplication: Math.min(100, Math.round(scoreVal * 0.9)),
      precedentUsage: Math.min(100, Math.round(scoreVal * 0.85)),
      analyticalLogic: Math.min(100, Math.round(scoreVal * 1.02))
    };

    if (inputLower.includes('donoghue') || inputLower.includes('stevenson')) {
      return {
        understandingOfFacts: "You demonstrated a fair understanding of the decomposed snail in the ginger beer bottle. However, you must emphasize that the container was opaque, which is a crucial fact because it made intermediate examination by the distributor or consumer impossible, thus shifting the ultimate responsibility to the manufacturer.",
        issueIdentification: "You correctly spotted the negligence issue, but failed to frame it in strict legal terms. The core issue is whether a manufacturer owes a duty of care to the end consumer in the absence of contractual privity.",
        bareActAnalysis: "Since this is a common law tort case, there are no direct parliamentary Bare Act sections, but you should have referenced common law parameters of negligence and product liability.",
        caseLawAnalysis: "You relied solely on the general concept of negligence. A superior response would have discussed the historical limits of Winterbottom v. Wright (1842) and contrasted it with Heaven v. Pender (1883) to highlight the progressive expansion of tortious liability.",
        legalReasoningAnalysis: "Your logic starts strong but fails to bridge the gap of contractual privity. You assumed liability flows directly from damage, which was not the case in 1932. You must establish why a duty arises outside of contract.",
        simplifiedExplanation: "In Donoghue v Stevenson, the UK House of Lords established that manufacturers owe a duty of care to ultimate consumers. Lord Atkin formulated the 'Neighbour Principle': you must take reasonable care to avoid acts or omissions which you can reasonably foresee would be likely to injure your neighbor (anyone closely and directly affected by your act).",
        mistakesMade: [
          "Failing to discuss the significance of the container's opacity.",
          "Ignoring the historical barrier of 'privity of contract' that previously protected manufacturers.",
          "Not referencing Lord Atkin's Neighbour Principle."
        ],
        betterWayToSolve: "First, outline the parties and clarify the lack of contract. Second, explain why a duty of care must be established independently in tort. Third, apply the Neighbour Principle to the fact that the manufacturer sealed the bottle in a way that prevented intermediate inspection. Fourth, conclude that a breach occurred causing foreseeable harm.",
        modelAnswer: "A manufacturer of products, which he sells in such a form as to show that he intends them to reach the ultimate consumer in the form in which they left him with no reasonable possibility of intermediate examination, owes a duty to the consumer to take that reasonable care. Applying Lord Atkin's Neighbour Principle, Mrs. Donoghue is closely and directly affected by the manufacturer's acts; hence, Stevenson is liable in negligence despite the absence of privity of contract.",
        learningTips: [
          "Always establish duty of care before arguing breach or damages in tort law.",
          "Analyze the physical characteristics of the evidence (e.g., the opaque bottle) as they directly influence legal duties."
        ],
        scores,
        professorComments: "A commendable effort. You understand the basic story, but you need to write like a lawyer. Focus on the privity obstacle and how Lord Atkin bypassed it with the Neighbour Principle."
      };
    }

    if (inputLower.includes('carlill') || inputLower.includes('carbolic')) {
      return {
        understandingOfFacts: "You correctly identified the advertisement and the reward. You should make sure to mention the £1,000 bank deposit, as this is the material fact that defeated the defense's claim that the advertisement was a mere advertising 'puff'.",
        issueIdentification: "The key issues are: 1) Whether a unilateral advertisement can constitute a binding offer to the world; 2) Whether performance of the conditions is sufficient acceptance without notification; 3) Whether purchase and use of the ball constitutes valid consideration.",
        bareActAnalysis: "In India, Section 8 of the Indian Contract Act, 1872 explicitly codifies this by stating that performance of the conditions of a proposal is an acceptance of the proposal. Under English common law, the same unilateral contract principles apply.",
        caseLawAnalysis: "You missed comparing this with standard bilateral contracts where communication of acceptance is mandatory. Citing Williams v Carwardine would strengthen your analysis of rewards/unilateral offers.",
        legalReasoningAnalysis: "Your reasoning was slightly circular on the issue of communication. You must explain *why* communication was not required here: the offeror, by the nature of the offer, impliedly indicated that performance alone was sufficient acceptance.",
        simplifiedExplanation: "In Carlill v Carbolic Smoke Ball Co, the court held that an advertisement offering a reward is a unilateral offer to the entire world, which ripens into a contract with anyone who performs the conditions. The £1,000 bank deposit proved serious contractual intent. Performance is acceptance, and using the ball as directed is sufficient consideration.",
        mistakesMade: [
          "Not mentioning the £1,000 bank deposit proving contractual sincerity.",
          "Failing to explain the legal distinction between an invitation to treat and a unilateral offer.",
          "Omitting discussion on the waiver of communication of acceptance."
        ],
        betterWayToSolve: "Start by defining the advertisement: is it an offer or an invitation to treat? Explain that unilateral offers are made to the world. Detail the exception to the communication rule (performance = acceptance). Identify the consideration (detriment to user / benefit to company sale). Conclude that a contract was formed.",
        modelAnswer: "The advertisement by the Carbolic Smoke Ball Co. was a unilateral offer. The deposit of £1,000 showed a clear intent to be legally bound, distinguishing it from a mere puff. Mrs. Carlill accepted the offer by performance (using the ball as directed) which also served as consideration. Communication of acceptance was waived by the nature of the unilateral offer. Therefore, a binding contract was formed and she is entitled to the £100 reward.",
        learningTips: [
          "In unilateral contracts, focus on the waiver of notification of acceptance.",
          "Distinguish clearly between unilateral offers and invitations to treat."
        ],
        scores,
        professorComments: "Good explanation of the unilateral offer. However, you must explicitly address the consideration element and the bank deposit, as these were the core battlegrounds in court."
      };
    }

    if (inputLower.includes('kesavananda') || inputLower.includes('bharati')) {
      return {
        understandingOfFacts: "You grasped the land reforms dispute. Crucially, you must highlight that the case transcended the petitioner's land rights and became a battleground over the 24th, 25th, and 29th Constitutional Amendments, which sought to establish absolute Parliamentary supremacy.",
        issueIdentification: "The principal issue is: What is the true scope of Parliament's power to amend the Constitution under Article 368? Does 'amendment' imply a power to alter the core identity or basic structure of the Constitution?",
        bareActAnalysis: "You must analyze Article 368 (amending power) in juxtaposition with Article 13 (judicial review of laws abridging fundamental rights) and the historical Article 19(1)(f) (right to property).",
        caseLawAnalysis: "You should have outlined the transition of precedents from Sankari Prasad (1951) and Sajjan Singh (1965), which allowed unlimited amendments, to Golaknath (1967), which completely banned amendments of fundamental rights, leading to the Kesavananda compromise.",
        legalReasoningAnalysis: "Your analysis of the 7-6 majority decision was excellent, but you should explain the reasoning of Justice Khanna, who provided the pivotal vote. He argued that 'amendment' means modification, not replacement or destruction of the essential features.",
        simplifiedExplanation: "In Kesavananda Bharati (1973), the Supreme Court of India ruled that while Parliament has the power to amend any part of the Constitution (including Fundamental Rights), this power does not extend to destroying or altering the 'Basic Structure' of the Constitution (such as democracy, secularism, federalism, and judicial review).",
        mistakesMade: [
          "Treating the case as a simple property dispute without referencing parliamentary vs judicial sovereignty.",
          "Not detailing the transition of precedents from Golaknath.",
          "Failing to explain the linguistic interpretation of the word 'amend'."
        ],
        betterWayToSolve: "First, explain the constitutional conflict between Article 13 and Article 368. Second, track the history of precedents leading up to 1973. Third, define 'amend' as meaning to refine rather than destroy. Fourth, explain the Basic Structure doctrine as a protective shield for constitutional identity.",
        modelAnswer: "While Parliament has wide amending powers under Article 368, it cannot alter or destroy the Basic Structure of the Constitution. The word 'amend' implies that the original constitution must survive in its core identity. Essential features such as federalism, secularism, democracy, and judicial review constitute this basic structure and are immune from parliamentary amendment.",
        learningTips: [
          "When analyzing constitutional jurisprudence, always look at the historical context of power balances between branches of government.",
          "Focus on the literal vs purposive interpretation of the word 'amend' as argued by the judges."
        ],
        scores,
        professorComments: "A very solid attempt at Indian constitutional history. Ensure you list the specific elements that constitute the basic structure and reference the 7-6 judicial split."
      };
    }

    // Default Fallback
    return {
      understandingOfFacts: "You outlined the factual dispute. When analyzing any legal scenario, start by mapping the parties, their relationships (contractual, tortious, or statutory), and the specific act or omission that caused the dispute.",
      issueIdentification: "Frame the issues as precise questions of law. Avoid generic descriptions. For example, instead of 'contract breach', write: 'Whether Party A's delay in delivery constitutes a material breach under Section 73 of the Contract Act.'",
      bareActAnalysis: "Identify which legislative codes govern the dispute. Always reference the core Bare Act sections that define the rights or liabilities of the parties in the scenario.",
      caseLawAnalysis: "Look for precedents that deal with similar facts. In common law systems, decisions are guided by stare decisis. You must explain how past cases support or differentiate your scenario.",
      legalReasoningAnalysis: "Apply the IRAC method. Do not jump straight from facts to conclusion. State the legal rule, show how the facts fit into that rule, and then draw your conclusion.",
      simplifiedExplanation: "This case involves a typical dispute over liability. Resolving it requires looking at: 1) Did a legal duty or contract exist? 2) Was there a breach of that duty? 3) Did the breach directly cause the damage? 4) Are there any valid statutory exceptions or force majeure defenses?",
      mistakesMade: [
        "Jumping to conclusions without step-by-step statutory application.",
        "Not citing relevant Bare Act sections.",
        "Failing to frame the legal issues as objective questions."
      ],
      betterWayToSolve: "1. Define the legal relationship. 2. Identify the governing sections. 3. Break down the sections into elements. 4. Match the facts to the elements. 5. Conclude based on whether all elements are satisfied.",
      modelAnswer: "To establish liability, the claimant must prove a valid legal obligation, a subsequent breach, and direct causation of damage. Applying the relevant statutory rules, the defendant is liable because their action directly violated the obligation without any qualifying statutory defense.",
      learningTips: [
        "Use the IRAC method for all legal problem solving.",
        "Always read the exceptions and provisos of a section, as they usually decide the outcome."
      ],
      scores,
      professorComments: "You have a good grasp of the facts, but your reasoning is too conversational. You must adopt a formal, analytical legal writing style, citing rules and sections for every claim."
    };
  }

  async researchMentorIntro(userId: string, topic: string) {
    const fallback = {
      areaOfLaw: 'Indian Law',
      explanation: `This question concerns the legal framework governing "${topic}" under Indian law.`,
      importance: 'Understanding this issue is essential for legal practice and structured advocacy.',
      mentorIntroduction: `Great question. Instead of directly finding the answer, I will teach you how an experienced advocate researches this issue. We will go through seven research stages together. By the end, you will know not only the answer but also how to research similar legal problems yourself.`,
    };

    try {
      const completion = await this.ai.complete({
        userId,
        module: 'research',
        temperature: 0.3,
        maxTokens: 500,
        jsonMode: true,
        messages: [
          {
            role: 'system',
            content: 'You are a senior advocate at a Delhi law firm mentoring a junior lawyer. Return strict JSON only.',
          },
          {
            role: 'user',
            content: `A junior lawyer wants to research: "${topic}"

You are their mentor. Return JSON with exactly these keys:
{
  "areaOfLaw": "Specific area of Indian law (e.g. Contract Law, Constitutional Law, Criminal Law)",
  "explanation": "2-3 sentences explaining what this legal question involves and why it is non-trivial",
  "importance": "1-2 sentences on why this issue matters in legal practice",
  "mentorIntroduction": "3-4 sentences in your voice as a senior advocate: acknowledge the question, tell them you will teach them how to research it step by step, briefly hint at what they will discover through the 7-stage process"
}`,
          },
        ],
      });
      const parsed = tryParseJson(completion.content, null);
      if (parsed && parsed.mentorIntroduction) {
        return {
          areaOfLaw: String(parsed.areaOfLaw || fallback.areaOfLaw),
          explanation: String(parsed.explanation || fallback.explanation),
          importance: String(parsed.importance || fallback.importance),
          mentorIntroduction: String(parsed.mentorIntroduction || fallback.mentorIntroduction),
        };
      }
    } catch {
      // fall through to fallback
    }

    return fallback;
  }

  async researchMentorStep(userId: string, topic: string, stepNumber: number) {
    const STEP_META = [
      {
        name: 'Identify the Legal Issue',
        coreQuestion: 'What exactly is the legal question we are answering?',
        why: 'Every piece of research must begin with a precise legal issue statement. Without this, you end up reading irrelevant statutes and spending hours going nowhere. A sharply defined issue is the anchor of your entire research.',
        advocateDoes: 'A senior advocate first separates the facts from the law. They ask: what is the legal right in dispute? What test does a court apply? What outcome is possible? Only then do they open a statute book.',
        mistakes: ['Starting research without framing the issue first', 'Being too vague ("it\'s a contract problem") instead of precise', 'Confusing factual disputes with legal questions'],
      },
      {
        name: 'Identify Governing Law & Statute',
        coreQuestion: 'Which Act of Parliament or state legislature directly governs this dispute?',
        why: 'Statutes always come before judgments. Cases interpret statutes — so if you do not know which statute governs, you will misread the cases. Always read the law first, then the cases that interpret it.',
        advocateDoes: 'The advocate identifies the primary Central or State Act, then checks for any subordinate legislation (rules, regulations, notifications). They note the year of the Act and check if recent amendments apply.',
        mistakes: ['Going straight to cases without reading the statute', 'Relying on an old version of the Act without checking amendments', 'Missing subordinate legislation like Rules framed under the Act'],
      },
      {
        name: 'Read the Relevant Bare Act Provisions',
        coreQuestion: 'What do the exact words of the statute say?',
        why: 'Courts are bound by the text of the statute. No commentary, no blog, no judgment can override the plain words of the law. Reading the bare act first prevents you from accepting someone else\'s interpretation without verification.',
        advocateDoes: 'The advocate reads: the Definitions section first (always Section 2), then the key operative section, then any exceptions or provisos. They underline every word that could be interpreted differently.',
        mistakes: ['Reading commentaries before the bare act', 'Ignoring provisos and exceptions', 'Not reading the definition of key terms used in the operative section'],
      },
      {
        name: 'Find Leading Judgments',
        coreQuestion: 'Which Supreme Court or High Court judgment most directly interprets this provision?',
        why: 'Indian law operates on precedent (stare decisis). The Supreme Court\'s interpretation of a statutory provision is binding on all courts under Article 141 of the Constitution. You must know the leading case.',
        advocateDoes: 'The advocate searches SCC Online, Manupatra, or IndianKanoon using the section number + Act name. They look for Constitution Bench decisions first, then 3-judge benches, then 2-judge benches. Older landmark decisions are often the most important.',
        mistakes: ['Citing an overruled judgment', 'Treating High Court decisions as binding across India', 'Ignoring the size of the bench (larger bench overrides smaller bench)'],
      },
      {
        name: 'Analyze the Cases',
        coreQuestion: 'What is the ratio decidendi of the leading judgment, and does it apply to our facts?',
        why: 'Every judgment has two parts: obiter dicta (things said in passing) and ratio decidendi (the binding legal principle). Only the ratio is binding. Misidentifying these is a serious research error.',
        advocateDoes: 'The advocate reads the facts of the case, identifies the legal issue the court decided, finds the rule the court laid down, and then asks: are our facts similar enough for this ratio to apply? If not, they look for a case to distinguish it.',
        mistakes: ['Treating obiter dicta as binding law', 'Not reading the facts of the case before citing it', 'Assuming a case applies without checking if the facts are distinguishable'],
      },
      {
        name: 'Apply the Law to the Facts',
        coreQuestion: 'Does the statute, read in light of the case law, resolve our specific facts?',
        why: 'Knowing the law is only half the job. The entire purpose of research is to answer your specific question. Applying law to facts is what separates a lawyer from a librarian.',
        advocateDoes: 'The advocate uses the IRAC method: Issue (already defined), Rule (the statute + ratio of leading case), Application (matching facts to legal elements one by one), Conclusion. They write this analysis out explicitly.',
        mistakes: ['Jumping straight from law to conclusion without the application step', 'Ignoring facts that do not fit the rule', 'Applying the ratio without checking if the facts are sufficiently similar'],
      },
      {
        name: 'Reach a Reasoned Legal Conclusion',
        coreQuestion: 'What is the most legally defensible answer to the original question?',
        why: 'Research without a conclusion is useless. An advocate must give a clear, reasoned opinion — not a "maybe" or "it depends." Clients pay for conclusions. Courts require conclusions. Hedging is not advocacy.',
        advocateDoes: 'The advocate states the conclusion clearly, explains the legal basis, acknowledges any uncertainty (conflicting benches, unanswered questions), and recommends next steps if needed. They always date and sign their research notes.',
        mistakes: ['Giving an opinion without reasoning', 'Refusing to conclude because of minor uncertainty', 'Not stating which way conflicting judgments lean'],
      },
    ];

    const step = STEP_META[Math.max(0, Math.min(6, stepNumber - 1))];

    const fallback = {
      stepNumber,
      title: step.name,
      coreQuestion: step.coreQuestion,
      whyThisStep: step.why,
      whatAdvocateDoes: step.advocateDoes,
      appliedExample: `For your topic "${topic}": a senior advocate would apply this step by first focusing on ${step.name.toLowerCase()} directly relevant to the specific legal question raised.`,
      commonMistakes: step.mistakes,
      mentorNote: `Pay close attention to this step — it is where most junior lawyers make avoidable errors.`,
    };

    try {
      const completion = await this.ai.complete({
        userId,
        module: 'research',
        temperature: 0.3,
        maxTokens: 900,
        jsonMode: true,
        messages: [
          {
            role: 'system',
            content: 'You are a senior advocate at a leading Delhi law firm mentoring a junior lawyer. Your teaching style is conversational, precise, and practical. Return strict JSON only.',
          },
          {
            role: 'user',
            content: `The junior is learning research methodology. The topic they are researching: "${topic}"
Current teaching step: Step ${stepNumber}/7 — "${step.name}"

Explain this research step as a mentor would. Use the topic as a live example throughout.

Return JSON with exactly these keys:
{
  "stepNumber": ${stepNumber},
  "title": "${step.name}",
  "coreQuestion": "The one question this step answers",
  "whyThisStep": "2-3 sentences: why this step is done before the next, what goes wrong if skipped",
  "whatAdvocateDoes": "2-3 sentences: what a senior advocate actually does in this step in practice",
  "appliedExample": "2-3 sentences: apply this step specifically to '${topic}' — show what the output of this step would look like for THIS topic",
  "commonMistakes": ["3 specific mistakes junior lawyers make at this step"],
  "mentorNote": "One closing sentence of practical wisdom from a senior advocate"
}`,
          },
        ],
      });
      const parsed = tryParseJson(completion.content, null);
      if (parsed && parsed.title && parsed.whyThisStep) {
        return {
          stepNumber,
          title: String(parsed.title || step.name),
          coreQuestion: String(parsed.coreQuestion || step.coreQuestion),
          whyThisStep: String(parsed.whyThisStep || step.why),
          whatAdvocateDoes: String(parsed.whatAdvocateDoes || step.advocateDoes),
          appliedExample: String(parsed.appliedExample || fallback.appliedExample),
          commonMistakes: Array.isArray(parsed.commonMistakes) ? parsed.commonMistakes : step.mistakes,
          mentorNote: String(parsed.mentorNote || fallback.mentorNote),
        };
      }
    } catch {
      // fall through to fallback
    }

    return fallback;
  }

  async researchMentorGenerate(userId: string, topic: string) {
    const fallback = {
      legalIssue: `Whether ${topic} is legally permissible and enforceable under the applicable Indian statutory framework.`,
      areaOfLaw: 'Indian Law',
      governingStatutes: 'The applicable Central or State Acts governing this topic.',
      relevantProvisions: 'Key sections of the governing statutes that directly address the legal question.',
      leadingJudgments: 'Landmark Supreme Court and High Court judgments interpreting the relevant provisions.',
      caseAnalysis: 'Analysis of the ratio decidendi of the leading cases and their application to the legal question.',
      applicationToFacts: 'Application of the statutory provisions and judicial precedents to the specific legal question raised.',
      conclusion: `Based on the applicable law and judicial precedents, ${topic} is subject to specific legal conditions under Indian law. A detailed analysis of the governing statutes and leading cases is required for a definitive opinion.`,
      practicePoints: [
        'Always verify the current version of the statute — check for recent amendments.',
        'Prefer Supreme Court judgments over High Court decisions where both exist.',
        'Note the composition of the bench — a larger bench overrides a smaller bench.',
      ],
    };

    try {
      const completion = await this.ai.complete({
        userId,
        module: 'research',
        temperature: 0.2,
        maxTokens: 2000,
        jsonMode: true,
        messages: [
          {
            role: 'system',
            content: 'You are a senior advocate preparing a professional research memorandum for a client. Return strict JSON only.',
          },
          {
            role: 'user',
            content: `Prepare a complete professional legal research memorandum on: "${topic}"

Follow the 7-step research methodology: Issue → Governing Law → Bare Act Provisions → Leading Judgments → Case Analysis → Application → Conclusion.

Return JSON with exactly these keys:
{
  "legalIssue": "Precise legal issue statement (1-2 sentences as a legal question)",
  "areaOfLaw": "Specific area(s) of Indian law",
  "governingStatutes": "All applicable Central and State Acts with year",
  "relevantProvisions": "Key sections/articles with brief description of what each provides",
  "leadingJudgments": "3-5 leading Supreme Court or High Court judgments with citation and brief ratio",
  "caseAnalysis": "Analysis of how the cases interpret the provisions — ratio decidendi, distinguishing factors",
  "applicationToFacts": "Direct application of the law to the specific legal question",
  "conclusion": "Clear, reasoned legal conclusion",
  "practicePoints": ["3-4 practical points a practitioner should note about this area"]
}`,
          },
        ],
      });
      const parsed = tryParseJson(completion.content, null);
      if (parsed && parsed.legalIssue && parsed.conclusion) {
        return {
          legalIssue: String(parsed.legalIssue || fallback.legalIssue),
          areaOfLaw: String(parsed.areaOfLaw || fallback.areaOfLaw),
          governingStatutes: String(parsed.governingStatutes || fallback.governingStatutes),
          relevantProvisions: String(parsed.relevantProvisions || fallback.relevantProvisions),
          leadingJudgments: String(parsed.leadingJudgments || fallback.leadingJudgments),
          caseAnalysis: String(parsed.caseAnalysis || fallback.caseAnalysis),
          applicationToFacts: String(parsed.applicationToFacts || fallback.applicationToFacts),
          conclusion: String(parsed.conclusion || fallback.conclusion),
          practicePoints: Array.isArray(parsed.practicePoints) ? parsed.practicePoints : fallback.practicePoints,
        };
      }
    } catch {
      // fall through to fallback
    }

    return fallback;
  }

  async researchMentorEvaluate(userId: string, body: {
    topic: string;
    stepNumber: number;
    stepName: string;
    userAnswer: string;
    isLastStep: boolean;
  }) {
    const topic = String(body.topic || '').trim();
    const stepNumber = Number(body.stepNumber || 1);
    const stepName = String(body.stepName || '');
    const userAnswer = String(body.userAnswer || '').trim();
    const isLastStep = Boolean(body.isLastStep);

    if (!topic || !userAnswer) throw new Error('topic and userAnswer are required');

    const ALL_STEPS = [
      'Identify the Legal Issue',
      'Identify Governing Law & Statute',
      'Read the Relevant Bare Act Provisions',
      'Find Leading Judgments',
      'Analyze the Cases',
      'Apply the Law to the Facts',
      'Reach a Reasoned Legal Conclusion',
    ];
    const nextStepName = stepNumber < 7 ? ALL_STEPS[stepNumber] : '';

    const summaryInstruction = isLastStep
      ? '\nSince this is the final step, if isCorrect is true also include a "finalSummary" key with: legalIssue, applicableStatutes, relevantSections, leadingJudgments, ratioDecidendi, applicationToFacts, reasonedConclusion, keyLearnings (array of strings).'
      : '';

    const nextStepInstruction = !isLastStep
      ? `Also include "nextStepTask" (specific instruction for Step ${stepNumber + 1}: ${nextStepName}, tailored to topic, only if isCorrect is true, else empty string) and "nextStepHint" (brief hint for Step ${stepNumber + 1}, only if isCorrect is true, else empty string).`
      : 'Include "nextStepTask": "" and "nextStepHint": "".';

    const fallback = {
      isCorrect: false,
      feedback: 'Please review your answer and try again.',
      strengths: '',
      improvements: 'Ensure your answer directly addresses the step requirement.',
      nextStepTask: '',
      nextStepHint: '',
      finalSummary: null,
    };

    try {
      const completion = await this.ai.complete({
        userId,
        module: 'research',
        temperature: 0.3,
        maxTokens: isLastStep ? 1200 : 600,
        jsonMode: true,
        messages: [
          {
            role: 'system',
            content: 'You are a senior advocate reviewing a junior lawyer\'s research. Be pedagogically honest but encouraging. Return strict JSON only.',
          },
          {
            role: 'user',
            content: `Research Topic: "${topic}"
Step ${stepNumber}/7: ${stepName}
Junior's Answer: "${userAnswer.slice(0, 600)}"

Evaluate whether this answer demonstrates genuine understanding of "${stepName}" for this topic.
Accept answers showing real legal reasoning even if imperfect.
Reject only if clearly wrong, off-topic, or too vague (e.g. single word, "I don't know").${summaryInstruction}

Return JSON with: isCorrect (bool), feedback (2-3 warm mentor sentences), strengths (1-2 sentences, empty if none), improvements (1-2 sentences, empty if isCorrect). ${nextStepInstruction}`,
          },
        ],
      });
      const parsed = tryParseJson(completion.content, null);
      if (parsed && typeof parsed.isCorrect === 'boolean') {
        return {
          isCorrect: Boolean(parsed.isCorrect),
          feedback: String(parsed.feedback || fallback.feedback),
          strengths: String(parsed.strengths || ''),
          improvements: String(parsed.improvements || ''),
          nextStepTask: String(parsed.nextStepTask || ''),
          nextStepHint: String(parsed.nextStepHint || ''),
          finalSummary: parsed.finalSummary || null,
        };
      }
    } catch {
      // fall through to fallback
    }

    return fallback;
  }

  async researchMentorSessionStart(userId: string, topic: string) {
    const STAGE_TITLES = [
      'Identify the Legal Issue',
      'Identify Governing Law & Statute',
      'Read the Relevant Bare Act Provisions',
      'Find Leading Judgments',
      'Analyze the Cases',
      'Apply the Law to the Facts',
      'Reach a Reasoned Legal Conclusion',
    ];

    const systemPrompt = `You are Adv. Raghav Mehta, Senior Advocate with 25 years at Delhi High Court. You are personally mentoring a junior law student through 7 stages of legal research. Your teaching is a MASTERCLASS — not a summary. You teach from first principles, never assume prior knowledge, and always name real statutes, real section numbers, and real cases.

ABSOLUTE RULES — NEVER BREAK THESE:
1. Every "appliedExample" must name the specific Indian Act with year, specific section numbers, and real Supreme Court or High Court cases with year and bench strength.
2. For criminal law topics: use BNSS 2023 and BNS 2023 (NOT CrPC or IPC — they are repealed).
3. Never write: "the applicable statute", "a leading case", "the relevant provision" — always name them explicitly.
4. Every stage must teach the CONCEPT, not just describe what the step is.
5. Write as a senior advocate mentoring a junior — conversational, professional, never robotic.
6. Return ONLY valid JSON — no markdown, no code blocks, no text outside the JSON object.`;

    const userPrompt = `Research topic: "${topic}"

First, identify these specifics for this topic (use them in every relevant field):
— Primary area of Indian law
— Primary Central/State Act (with year) governing this topic
— 3-4 specific section numbers most relevant to this topic
— 3-4 real Supreme Court or High Court cases with year, bench strength, and brief ratio

Now generate the complete session JSON for this topic. Each stage must be a complete learning module.

DEPTH REQUIREMENTS PER STAGE:
- "introduction": 200-300 words — WHY this stage exists, why experienced lawyers never skip it, what beginners get wrong here, and the consequences of skipping it
- "coreConcept": 400-600 words — teach the concept from first principles; explain the professional thought process (what questions does the advocate ask themselves? what documents do they open first? what do they deliberately ignore? what are they trying to discover?); explain why courts follow this methodology; give 2-3 examples from different areas of law (constitutional, criminal, civil, environmental)
- "workflow": array of 5-6 strings, each 60-100 words — a numbered step-by-step workflow of exactly what to do at this stage
- "appliedExample": 300-400 words — ACTUALLY PERFORM this stage for "${topic}"; name the real statute with section numbers; cite real cases; show the actual output of this stage as a professional would produce it
- "commonMistakes": array of 4-5 strings, each 80-120 words — explain WHAT the mistake is, WHY students make it, WHAT the professional consequences are, and HOW experienced advocates avoid it
- "practicalTips": array of 4-5 strings, each 50-70 words — professional advice from 25 years of practice; include how professors expect students to research, how advocates prepare briefs, how judges frame issues
- "checklist": array of 6-8 strings starting with "✓ I have..." — specific completion criteria the student must satisfy before continuing
- "transitionSentence": 2-3 sentences — explain why Stage N+1 naturally and necessarily follows from what was just completed

{
  "intro": {
    "areaOfLaw": "Specific area of Indian law + primary statute name with year",
    "explanation": "3-4 sentences: what this topic involves, which statute governs it, and what makes it legally significant",
    "importance": "2-3 sentences: practical consequences of getting this wrong in practice — client risk, procedural risk, professional risk",
    "mentorIntroduction": "4-5 sentences as Adv. Raghav Mehta — be specific about the statute, share what makes this topic tricky, and set expectations for the 7-stage journey"
  },
  "stages": [
    {
      "stepNumber": 1,
      "title": "Identify the Legal Issue",
      "coreQuestion": "Precise court-level legal question for '${topic}' — must include the applicable statute and section reference",
      "introduction": "200-300 words: why issue identification exists as a discipline, why experienced lawyers spend real time on this before touching any statute, what beginners do instead and why it fails",
      "coreConcept": "400-600 words: teach what a legal issue actually is; how it differs from a factual question; how courts frame issues; the difference between broad issues and narrow sub-issues; professional thought process for '${topic}'; examples from constitutional law, criminal law, civil law, environmental law showing how issue framing shapes the entire research",
      "workflow": [
        "Step 1 — [Action Title]: 60-100 words explaining exactly what to do",
        "Step 2 — [Action Title]: ...",
        "Step 3 — [Action Title]: ...",
        "Step 4 — [Action Title]: ...",
        "Step 5 — [Action Title]: ..."
      ],
      "appliedExample": "300-400 words: perform this stage for '${topic}' — write the actual legal issue statement, identify sub-issues, show how the framing connects to specific statutory provisions by name and section number",
      "commonMistakes": [
        "80-120 words: mistake 1 — what it is, why students make it, professional consequence, how to avoid it",
        "80-120 words: mistake 2",
        "80-120 words: mistake 3",
        "80-120 words: mistake 4"
      ],
      "practicalTips": [
        "50-70 words: professional tip 1",
        "50-70 words: professional tip 2",
        "50-70 words: professional tip 3",
        "50-70 words: professional tip 4"
      ],
      "checklist": [
        "✓ I have identified the primary legal question raised by this topic",
        "✓ I have ...",
        "✓ I have ...",
        "✓ I have ...",
        "✓ I have ...",
        "✓ I have ..."
      ],
      "transitionSentence": "2-3 sentences: why Stage 2 (identifying governing law) necessarily follows from having a clear issue statement"
    },
    {
      "stepNumber": 2,
      "title": "Identify Governing Law & Statute",
      "coreQuestion": "...",
      "introduction": "200-300 words",
      "coreConcept": "400-600 words: explain the hierarchy of Indian law (Constitution → Parliamentary Acts → State Acts → Subordinate Legislation → Notifications/Rules); how to determine which Act governs; what 'governing law' means in practice; how central and state jurisdiction interact; examples from different areas; professional methodology",
      "workflow": ["Step 1 — ...", "Step 2 — ...", "Step 3 — ...", "Step 4 — ...", "Step 5 — ..."],
      "appliedExample": "300-400 words: name the exact governing Act(s) with year for '${topic}', the specific sections most relevant, whether any State Act supplements the Central Act, and which Rules or notifications are in force",
      "commonMistakes": ["80-120 words each — 4 mistakes specific to statute identification for '${topic}'"],
      "practicalTips": ["50-70 words each — 4 professional tips"],
      "checklist": ["✓ I have identified...", "6-8 items"],
      "transitionSentence": "2-3 sentences"
    },
    {
      "stepNumber": 3,
      "title": "Read the Relevant Bare Act Provisions",
      "coreQuestion": "...",
      "introduction": "200-300 words: why reading the bare act yourself (not a commentary) is non-negotiable; what happens when lawyers skip this; the professional norm",
      "coreConcept": "400-600 words: teach how to READ a statute professionally — Definitions first, then operative section, then provisos and exceptions; how to identify cross-references; how to read 'notwithstanding' and 'subject to' clauses; how judges interpret statutory language; the plain meaning rule and its exceptions; examples from real Indian statutes",
      "workflow": ["5-6 steps with 60-100 words each"],
      "appliedExample": "300-400 words: paraphrase or quote the key sections for '${topic}' with section numbers; highlight the operative words and their legal significance; identify the proviso or exception that matters most",
      "commonMistakes": ["4-5 mistakes about bare act reading, 80-120 words each"],
      "practicalTips": ["4-5 tips about statute reading, 50-70 words each"],
      "checklist": ["6-8 items"],
      "transitionSentence": "2-3 sentences"
    },
    {
      "stepNumber": 4,
      "title": "Find Leading Judgments",
      "coreQuestion": "...",
      "introduction": "200-300 words: why case law matters; the doctrine of precedent under Article 141; why you must know the cases before advising a client; the structure of Indian judicial hierarchy",
      "coreConcept": "400-600 words: explain the judicial hierarchy (Constitution Bench → 3-judge → 2-judge → Single judge); how bench strength determines binding force; the difference between binding precedent and persuasive authority; how to search effectively on SCC Online and IndianKanoon; what search terms to use; how to identify whether a case has been overruled or distinguished",
      "workflow": ["5-6 steps on how to find and shortlist cases, 60-100 words each"],
      "appliedExample": "300-400 words: name 3-4 real Supreme Court and High Court cases on '${topic}' with citation, bench strength, and what each case specifically decided — not just case names but what the actual ruling was",
      "commonMistakes": ["4-5 mistakes about case finding, 80-120 words each"],
      "practicalTips": ["4-5 tips about case research, 50-70 words each"],
      "checklist": ["6-8 items"],
      "transitionSentence": "2-3 sentences"
    },
    {
      "stepNumber": 5,
      "title": "Analyze the Cases",
      "coreQuestion": "...",
      "introduction": "200-300 words: the difference between finding a case and understanding it; why citation without analysis is dangerous; what judges and professors expect when you cite authority",
      "coreConcept": "400-600 words: teach the difference between ratio decidendi and obiter dicta; how to identify the ratio (the legal rule applied to the material facts); how courts distinguish cases; how to build a chain of authority; how conflicting benches work; the concept of per incuriam; examples from Indian constitutional and civil law",
      "workflow": ["5-6 steps on how to analyze a judgment, 60-100 words each"],
      "appliedExample": "300-400 words: perform actual case analysis for '${topic}' — extract the ratio from the leading case(s), identify the binding rule, assess whether it applies to this topic, and note any cases that qualify or distinguish the main ratio",
      "commonMistakes": ["4-5 mistakes about case analysis, 80-120 words each"],
      "practicalTips": ["4-5 tips about case analysis, 50-70 words each"],
      "checklist": ["6-8 items"],
      "transitionSentence": "2-3 sentences"
    },
    {
      "stepNumber": 6,
      "title": "Apply the Law to the Facts",
      "coreQuestion": "...",
      "introduction": "200-300 words: why application is the hardest step; what separates good legal analysis from mere legal knowledge; why courts expect structured application",
      "coreConcept": "400-600 words: teach the IRAC method (Issue, Rule, Application, Conclusion) in depth; how to match facts to statutory elements; what to do when facts partially satisfy the rule; how to handle ambiguous or missing facts; the difference between applying law to facts and merely citing law; examples from Indian court judgments that demonstrate clean IRAC reasoning",
      "workflow": ["5-6 steps of IRAC application, 60-100 words each"],
      "appliedExample": "300-400 words: perform IRAC application for '${topic}' — state the issue, cite the specific statutory rule and case ratio, apply them to the concrete facts element by element, and show the logical pathway to a conclusion",
      "commonMistakes": ["4-5 mistakes about legal application, 80-120 words each"],
      "practicalTips": ["4-5 tips about structured legal application, 50-70 words each"],
      "checklist": ["6-8 items"],
      "transitionSentence": "2-3 sentences"
    },
    {
      "stepNumber": 7,
      "title": "Reach a Reasoned Legal Conclusion",
      "coreQuestion": "...",
      "introduction": "200-300 words: why conclusions matter; why 'it depends' is not a legal conclusion; what a professional legal opinion looks like; what clients and courts expect",
      "coreConcept": "400-600 words: teach how to structure a legal opinion; how to state conclusions with appropriate confidence; how to handle genuine uncertainty (conflicting benches, unsettled law); how to recommend next steps; the difference between an academic answer and a professional opinion; how to caveat without hedging",
      "workflow": ["5-6 steps for drafting the conclusion, 60-100 words each"],
      "appliedExample": "300-400 words: state the full reasoned conclusion for '${topic}' — lead with the answer, support it with statutory basis and case authority, acknowledge any qualifications, and suggest next steps if further information is needed",
      "commonMistakes": ["4-5 mistakes about conclusions, 80-120 words each"],
      "practicalTips": ["4-5 tips about legal opinion writing, 50-70 words each"],
      "checklist": ["6-8 items — final comprehensive checklist covering the entire 7-stage journey"],
      "transitionSentence": ""
    }
  ],
  "finalMemo": {
    "legalIssue": "Precise 1-2 sentence court-level issue statement for '${topic}'",
    "areaOfLaw": "Area with specific Act name and year",
    "governingStatutes": "Exact Act names with year — no placeholder phrases",
    "relevantProvisions": "Section numbers with what each section provides for '${topic}'",
    "leadingJudgments": "4-5 real cases: case name, court, year, bench strength, ratio specific to '${topic}'",
    "caseAnalysis": "How the key cases interpret the provisions for '${topic}'",
    "applicationToFacts": "Statutory and case law applied directly to '${topic}'",
    "conclusion": "Clear reasoned conclusion citing specific statute and case authority",
    "practicePoints": ["4-5 practical tips specific to '${topic}' practice area"]
  }
}`;

    const fallback = this.buildMentorSessionFallback(topic, STAGE_TITLES);

    let sessionData = fallback;
    try {
      const completion = await this.ai.complete({
        userId,
        module: 'research',
        temperature: 0.4,
        maxTokens: 60000,
        jsonMode: true,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });
      const parsed = tryParseJson(completion.content, null);
      if (
        parsed &&
        parsed.intro &&
        Array.isArray(parsed.stages) &&
        parsed.stages.length >= 1 &&
        parsed.finalMemo
      ) {
        // Pad missing stages with fallback stages if AI returned fewer than 7
        if (parsed.stages.length < 7) {
          parsed.stages = [
            ...parsed.stages,
            ...fallback.stages.slice(parsed.stages.length),
          ];
        }
        sessionData = parsed;
      }
    } catch (err) {
      console.error('[ResearchMentor] AI call failed, using fallback:', err instanceof Error ? err.message : String(err));
    }

    const record = this.mentorSessionRepo.create({ userId, topic, sessionData });
    const saved = await this.mentorSessionRepo.save(record);
    return { sessionId: saved.id, topic, ...sessionData };
  }

  async researchMentorSessionGet(userId: string, sessionId: string) {
    const record = await this.mentorSessionRepo.findOne({
      where: { id: sessionId, userId },
    });
    if (!record) return null;
    return { sessionId: record.id, topic: record.topic, ...record.sessionData };
  }

  async conductResearchAssistant(userId: string, question: string) {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const correlationId = `corr_${Math.random().toString(36).slice(2, 10)}`;
    const pipelineStart = Date.now();

    const STAGE_MAP: Record<number, string> = {
      1: 'Understand Question', 2: 'Design Research Strategy', 3: 'Statutory Research',
      4: 'Bare Act Reading', 5: 'Case Law Research', 6: 'Academic Research',
      7: 'Conflict Analysis', 8: 'Comparative Law', 9: 'Professional Legal Reasoning',
      10: 'Professional Research Memorandum', 11: 'Final Memorandum Assembly',
    };

    const auditStages: any[] = Object.entries(STAGE_MAP).map(([num, name]) => ({
      stageNumber: Number(num), stageName: name, status: 'WAITING',
      startTime: null, endTime: null, durationMs: null,
      provider: null, model: null,
      promptTokens: 0, completionTokens: 0, totalTokens: 0,
      retryCount: 0, fallbackUsed: false, error: null,
    }));

    const classifyRootCause = (msg: string): string => {
      const m = msg.toLowerCase();
      if (m.includes('429') || m.includes('rate limit') || m.includes('quota') || m.includes('resource_exhausted')) return 'RATE_LIMIT_EXCEEDED';
      if (m.includes('401') || m.includes('api key') || m.includes('authentication') || m.includes('unauthorized')) return 'INVALID_API_KEY';
      if (m.includes('timeout') || m.includes('abort') || m.includes('timed out')) return 'PROVIDER_TIMEOUT';
      if (m.includes('context') || m.includes('too long') || m.includes('maximum context')) return 'CONTEXT_WINDOW_EXCEEDED';
      if (m.includes('json') || m.includes('parse') || m.includes('incomplete')) return 'JSON_PARSE_FAILURE';
      if (m.includes('503') || m.includes('overload') || m.includes('unavailable')) return 'PROVIDER_OVERLOADED';
      if (m.includes('network') || m.includes('fetch') || m.includes('econnrefused')) return 'NETWORK_ERROR';
      if (m.includes('schema') || m.includes('stages') || m.includes('incomplete json')) return 'SCHEMA_VALIDATION_FAILURE';
      return 'UNKNOWN_FAILURE';
    };

    const getRecommendation = (rc: string): string => ({
      RATE_LIMIT_EXCEEDED: 'Enable billing on your Gemini project at console.cloud.google.com/billing, or create a new API key with fresh quota',
      INVALID_API_KEY: 'Generate a new valid API key at aistudio.google.com and update GEMINI_API_KEY in server/.env',
      PROVIDER_TIMEOUT: 'The AI provider was temporarily slow — retry immediately',
      CONTEXT_WINDOW_EXCEEDED: 'Narrow the research question to a more specific legal issue',
      JSON_PARSE_FAILURE: 'Retry research — AI returned malformed JSON on this attempt',
      PROVIDER_OVERLOADED: 'Wait 60 seconds then retry — provider is handling high load',
      NETWORK_ERROR: 'Check server internet connectivity and restart the NestJS server',
      SCHEMA_VALIDATION_FAILURE: 'Retry research — AI returned fewer stages than required',
    }[rc] || 'Retry research or contact LEGATRIXON support');

    const getNextAction = (rc: string): string => ({
      RATE_LIMIT_EXCEEDED: 'Open console.cloud.google.com → Billing → Link billing account to project 279548103334',
      INVALID_API_KEY: 'Open aistudio.google.com/app/apikey → Create API key → Update server/.env',
      PROVIDER_TIMEOUT: 'Click Retry Research',
      JSON_PARSE_FAILURE: 'Click Retry Research',
      PROVIDER_OVERLOADED: 'Wait 60 seconds, then click Retry Research',
      NETWORK_ERROR: 'Check your network connection and restart the server',
    }[rc] || 'Click Retry Research');

    const markBatchCompleted = (nums: number[], provider: string, model: string, batchStart: number) => {
      nums.forEach(n => {
        const s = auditStages.find(a => a.stageNumber === n);
        if (s) { s.status = 'COMPLETED'; s.startTime = batchStart; s.endTime = Date.now(); s.durationMs = Date.now() - batchStart; s.provider = provider; s.model = model; }
      });
    };

    const markBatchFailed = (nums: number[], errorMsg: string) => {
      nums.forEach((n, i) => {
        const s = auditStages.find(a => a.stageNumber === n);
        if (s) { s.status = i === 0 ? 'FAILED' : 'SKIPPED'; if (i === 0) s.error = errorMsg; }
      });
      const firstFailed = Math.min(...nums);
      auditStages.filter(a => a.stageNumber > firstFailed && a.status === 'WAITING').forEach(a => { a.status = 'SKIPPED'; });
    };

    const buildFailureResponse = (batchLabel: string, failedNums: number[], err: any) => {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const rootCause = classifyRootCause(errorMsg);
      markBatchFailed(failedNums, errorMsg);
      this.logger.error(`[ResearchAssistant] ${batchLabel} failed: ${errorMsg}`);
      return {
        executionStatus: 'FAILED',
        executionAudit: {
          executionId, correlationId,
          overallStatus: 'FAILED',
          progress: Math.round(((failedNums[0] - 1) / 11) * 100),
          executionTimeMs: Date.now() - pipelineStart,
          failureBatch: batchLabel,
          failureStage: STAGE_MAP[failedNums[0]] || batchLabel,
          failureStageIndex: failedNums[0],
          failureCategory: rootCause.replace(/_/g, ' '),
          rootCause,
          errorMessage: errorMsg,
          retryAttempts: 1,
          fallbackAttempted: true,
          recoverySucceeded: false,
          recommendation: getRecommendation(rootCause),
          nextAction: getNextAction(rootCause),
          stages: auditStages,
        },
      };
    };

    const systemPrompt = `You are LEGATRIXON Deep Legal Research Engine, acting like a Supreme Court senior advocate supervising a top-tier law-firm junior associate. You must perform genuine legal research, not template drafting. Do not use placeholders, bracketed examples, invented neutral phrases, or generic filler. If you cannot identify a specific authority, say exactly what could not be verified and why. Every legal proposition must be supported by a named authority: constitutional article, statutory provision, rule, notification, case citation, Law Commission Report, committee report, book, article, or comparative-law authority. Return strict JSON only.`;

    const stageSchema = `{
      "stageNumber": number,
      "title": string,
      "status": "Completed",
      "timeSpentMinutes": number,
      "sourcesFound": number,
      "summary": string,
      "researchNotes": string,
      "authoritiesAnalysed": [{ "name": string, "citation": string, "type": string, "whyRelevant": string, "treatment": string }],
      "caseAnalyses": [{ "caseName": string, "citation": string, "facts": string, "issues": string, "arguments": string, "reasoning": string, "ratioDecidendi": string, "obiterDicta": string, "holding": string, "laterTreatment": string, "currentStatus": string, "whyItMatters": string }],
      "statutoryFindings": [{ "provision": string, "plainMeaning": string, "ingredients": string, "exceptions": string, "crossReferences": string, "practicalApplication": string }],
      "keyObservations": string[],
      "professionalInsights": string[],
      "sources": [{ "title": string, "type": string, "citation": string }],
      "nextStep": string
    }`;

    const callOptionsBase = { userId, module: 'research' as const, temperature: 0.15, timeoutMs: 180000, jsonMode: true };
    // Batch 1 & 2: 5 stages of deep research each — need large output budgets
    const callOptionsBatch = { ...callOptionsBase, maxTokens: 40000 };
    // Final memorandum: single structured document — smaller budget
    const callOptionsMemo = { ...callOptionsBase, maxTokens: 16000 };
    let lastProvider = '';
    let lastModel = '';

    // ── Batch 1: Stages 1–5 ──────────────────────────────────────────────────
    auditStages.filter(a => [1,2,3,4,5].includes(a.stageNumber)).forEach(a => { a.status = 'RUNNING'; a.startTime = Date.now(); });
    const b1Start = Date.now();
    let p1: any = null;

    try {
      const batch1Prompt = `Research assignment: "${question}"

Perform stages 1 through 5 of a deep legal research notebook. Return strict JSON:
{
  "question": "${question}",
  "areaOfLaw": string,
  "jurisdiction": "India",
  "researchLog": ["10 one-line entries describing what the researcher did in each stage"],
  "stages": [ /* exactly 5 stage objects for stages 1–5 */ ]
}

Each stage object: ${stageSchema}

Stage instructions (write substantive research prose, no templates):
1. Stage 1 — Understand the Question (stageNumber:1, title:"Understand the Question"): 600+ words. Identify primary/secondary issues, doctrines involved, required facts, assumptions to avoid, and why each affects the research path.
2. Stage 2 — Design Research Strategy (stageNumber:2, title:"Design Research Strategy"): 700+ words. Primary keywords, Boolean queries, databases, Latin maxims, search priority, and why each query is useful.
3. Stage 3 — Statutory Research (stageNumber:3, title:"Statutory Research"): 1000+ words. Constitution articles, Acts, rules, regulations, notifications, legislative history, object, cross-references.
4. Stage 4 — Bare Act Reading (stageNumber:4, title:"Bare Act Reading"): 1200+ words. Read every relevant provision: plain meaning, legislative intent, ingredients, scope, exceptions, judicial interpretation.
5. Stage 5 — Case Law Research (stageNumber:5, title:"Case Law Research"): 1500+ words. For every key case: facts, issues, arguments, reasoning, ratio decidendi, obiter, holding, later treatment, current status.

Quality: substantive researchNotes in every stage. Prefer Indian primary law and Supreme Court authority.`;

      const r1 = await this.ai.complete({ ...callOptionsBatch, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: batch1Prompt }] });
      lastProvider = r1.provider; lastModel = r1.model;
      p1 = tryParseJson<any>(r1.content, null);
      if (!p1 || !Array.isArray(p1.stages) || p1.stages.length < 5) throw new Error('Batch 1 (stages 1-5) returned incomplete JSON');
      markBatchCompleted([1,2,3,4,5], r1.provider, r1.model, b1Start);
    } catch (err) {
      return buildFailureResponse('Batch 1 (Stages 1–5)', [1,2,3,4,5], err);
    }

    // ── Batch 2: Stages 6–10 ─────────────────────────────────────────────────
    auditStages.filter(a => [6,7,8,9,10].includes(a.stageNumber)).forEach(a => { a.status = 'RUNNING'; a.startTime = Date.now(); });
    const b2Start = Date.now();
    let p2: any = null;

    try {
      const batch2Prompt = `Research assignment: "${question}"

Continue the deep legal research notebook with stages 6 through 10. Return strict JSON:
{ "stages": [ /* exactly 5 stage objects for stages 6–10 */ ] }

Each stage object: ${stageSchema}

Stage instructions:
6. Stage 6 — Academic Research (stageNumber:6, title:"Academic Research"): 1000+ words. Law Commission Reports, commentaries, books, Constituent Assembly Debates, scholarly disagreements.
7. Stage 7 — Conflict Analysis (stageNumber:7, title:"Conflict Analysis"): 800+ words. Conflicting precedents, conflicting High Court decisions, minority/majority views, grey areas, unresolved constitutional questions.
8. Stage 8 — Comparative Law (stageNumber:8, title:"Comparative Law"): 1000+ words. Compare India, UK, US, Canada, Australia, Singapore, EU — framework, advantages, weaknesses, lessons for India.
9. Stage 9 — Professional Legal Reasoning (stageNumber:9, title:"Professional Legal Reasoning"): 1000+ words. Senior advocate argument preparation: strengths, weaknesses, constitutional concerns, policy implications, practical strategy, likely judicial outcome.
10. Stage 10 — Research Memorandum Summary (stageNumber:10, title:"Professional Research Memorandum"): 1500+ words. Concise memorandum covering all findings, issues, applicable law, key case ratios, conclusion, and next steps.`;

      const r2 = await this.ai.complete({ ...callOptionsBatch, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: batch2Prompt }] });
      p2 = tryParseJson<any>(r2.content, null);
      if (!p2 || !Array.isArray(p2.stages) || p2.stages.length < 5) throw new Error('Batch 2 (stages 6-10) returned incomplete JSON');
      markBatchCompleted([6,7,8,9,10], r2.provider, r2.model, b2Start);
    } catch (err) {
      return buildFailureResponse('Batch 2 (Stages 6–10)', [6,7,8,9,10], err);
    }

    // ── Batch 3: Final Memorandum ─────────────────────────────────────────────
    const memoAuditStage = auditStages.find(a => a.stageNumber === 11);
    if (memoAuditStage) { memoAuditStage.status = 'RUNNING'; memoAuditStage.startTime = Date.now(); }
    const b3Start = Date.now();
    let p3: any = null;

    try {
      const batch3Prompt = `Research assignment: "${question}"

Write the Professional Research Memorandum for the above legal research. Return strict JSON:
{
  "finalMemorandum": {
    "title": string,
    "executiveSummary": string,
    "researchQuestion": string,
    "issues": string,
    "applicableLaw": string,
    "statutoryAnalysis": string,
    "caseLawAnalysis": string,
    "academicAnalysis": string,
    "comparativeAnalysis": string,
    "arguments": string,
    "counterArguments": string,
    "criticalEvaluation": string,
    "conclusion": string,
    "futureDevelopments": string,
    "footnotes": string[],
    "bibliography": { "casesCited": string[], "statutesCited": string[], "academicSources": string[], "comparativeSources": string[] }
  }
}

Write each section with substantive legal analysis. No placeholders. Minimum 300 words per major section (executiveSummary, statutoryAnalysis, caseLawAnalysis, arguments, conclusion). Include OSCOLA-style footnotes and a full bibliography.`;

      const r3 = await this.ai.complete({ ...callOptionsMemo, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: batch3Prompt }] });
      p3 = tryParseJson<any>(r3.content, null);
      if (!p3 || !p3.finalMemorandum) throw new Error('Batch 3 (final memorandum) returned incomplete JSON');
      if (memoAuditStage) { memoAuditStage.status = 'COMPLETED'; memoAuditStage.endTime = Date.now(); memoAuditStage.durationMs = Date.now() - b3Start; memoAuditStage.provider = r3.provider; memoAuditStage.model = r3.model; }
    } catch (err) {
      return buildFailureResponse('Batch 3 (Final Memorandum)', [11], err);
    }

    // ── Success ───────────────────────────────────────────────────────────────
    return {
      executionStatus: 'SUCCESS',
      sessionId: `ra_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      question,
      areaOfLaw: p1.areaOfLaw || 'Indian Law',
      jurisdiction: p1.jurisdiction || 'India',
      researchLog: Array.isArray(p1.researchLog) ? p1.researchLog : [],
      stages: [...p1.stages, ...p2.stages],
      finalMemorandum: p3.finalMemorandum,
      provider: lastProvider,
      model: lastModel,
      executionAudit: {
        executionId, correlationId,
        overallStatus: 'SUCCESS',
        progress: 100,
        executionTimeMs: Date.now() - pipelineStart,
        stages: auditStages,
      },
    };
  }

  private detectTopicContext(topic: string): { area: string; statute: string; sections: string; cases: string } {
    const t = topic.toLowerCase();
    if (/bail|anticipatory bail|regular bail|custody|remand/.test(t))
      return { area: 'Criminal Procedure', statute: 'Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)', sections: 'Sections 479–485', cases: 'Gurbaksh Singh Sibbia v State of Punjab (1980) 2 SCC 565; Sushila Aggarwal v State (NCT of Delhi) (2020) 5 SCC 1' };
    if (/murder|theft|robbery|assault|rape|offence|bns|ipc|penal|criminal law/.test(t))
      return { area: 'Criminal Law', statute: 'Bharatiya Nyaya Sanhita, 2023 (BNS)', sections: 'relevant BNS sections replacing IPC', cases: 'Bachan Singh v State of Punjab (1980) 2 SCC 684' };
    if (/contract|agreement|offer|acceptance|consideration|breach|performance|frustration/.test(t))
      return { area: 'Contract Law', statute: 'Indian Contract Act, 1872', sections: 'Sections 2, 10, 14–16, 23–27, 56, 73–74', cases: 'Hadley v Baxendale (1854) applied in India; Satyabrata Ghose v Mugneeram Bangur & Co (1954) SCR 310' };
    if (/constitution|fundamental rights|article 14|article 19|article 21|writ|habeas|mandamus|directive principles|federalism/.test(t))
      return { area: 'Constitutional Law', statute: 'Constitution of India, 1950', sections: 'Part III (Articles 12–35) and relevant Articles', cases: 'Kesavananda Bharati v State of Kerala (1973) 4 SCC 225; Maneka Gandhi v Union of India (1978) 1 SCC 248' };
    if (/property|land|transfer|mortgage|lease|sale deed|easement|title/.test(t))
      return { area: 'Property Law', statute: 'Transfer of Property Act, 1882', sections: 'Sections 5, 54, 58, 105, 118', cases: 'Delhi Development Authority v Kenneth Builders (2016) 13 SCC 561' };
    if (/company|corporate|director|shareholder|merger|acquisition|insolvency/.test(t))
      return { area: 'Corporate Law', statute: 'Companies Act, 2013', sections: 'relevant sections of CA 2013', cases: 'Dale and Carrington Invt. (P) Ltd v P.K. Prathapan (2005) 1 SCC 212' };
    if (/negligence|tort|defamation|nuisance|vicarious liability/.test(t))
      return { area: 'Law of Torts', statute: 'Common Law as applied in India', sections: 'no code — governed by common law principles', cases: 'MC Mehta v Union of India (1987) 1 SCC 395 (absolute liability)' };
    if (/divorce|marriage|matrimonial|custody|maintenance|hindu|muslim|personal law/.test(t))
      return { area: 'Family Law', statute: 'Hindu Marriage Act, 1955 (or relevant personal law statute)', sections: 'Sections 5, 13, 24–25 HMA; Section 125 BNSS for maintenance', cases: 'Sarla Mudgal v Union of India (1995) 3 SCC 635' };
    if (/tax|income tax|gst|customs|revenue|assessment/.test(t))
      return { area: 'Tax Law', statute: 'Income Tax Act, 1961 (or CGST Act, 2017)', sections: 'Sections 4, 9, 90, 147–148 (IT Act); Section 73 CGST Act', cases: 'CIT v Calcutta Discount Co. Ltd (1961) 41 ITR 191 (SC)' };
    if (/labour|employment|workman|retrenchment|termination|trade union|industrial dispute/.test(t))
      return { area: 'Labour Law', statute: 'Industrial Disputes Act, 1947', sections: 'Sections 2(s), 10, 11A, 25F–25N', cases: 'Workmen of Meenakshi Mills v Meenakshi Mills Ltd (1992) 3 SCC 336' };
    return { area: 'Indian Law', statute: 'the applicable Central or State Act', sections: 'relevant provisions', cases: 'leading Supreme Court judgments on this topic' };
  }

  private buildMentorSessionFallback(topic: string, stageTitles: string[]) {
    const ctx = this.detectTopicContext(topic);

    const STAGE_META = [
      {
        coreQuestion: `What is the precise legal question raised by the issue of "${topic}" — framed with the applicable statute and section?`,
        introduction: `Issue identification is the foundation of all legal research. Before opening any statute or search engine, experienced advocates spend considerable time framing the exact legal question. The reason is simple: a badly framed issue leads you to the wrong statute, the wrong cases, and ultimately, the wrong advice. Most junior lawyers skip this step entirely — they receive a problem and immediately search for cases, which means they are searching for answers to a question they have not properly defined. The consequence is hours of wasted research on irrelevant material and a research memorandum that does not actually answer the client's question.`,
        coreConcept: `A legal issue is not the same as a factual problem. When a client says "my employer has not paid me for three months," that is a factual statement. The legal issue is something different: it might be "Whether the employer's failure to pay wages for three months constitutes an offence under Section 25 of the Payment of Wages Act, 1936, entitling the employee to a claim before the Authority appointed under Section 15." Notice the difference — the legal issue names the statute, the section, the legal test, and the legal remedy. This is the form courts use when they frame issues. Senior advocates ask themselves: What right is being asserted? What obligation is being breached? What is the applicable legal test? What remedy does the claimant seek? They also separate the broad issue from any sub-issues. In a contract dispute, the main issue might be breach, but sub-issues might include validity of the contract, whether a particular clause is enforceable, and whether limitation has expired. Each sub-issue requires its own research path.`,
        workflow: [
          `Step 1 — Read the problem carefully and list every fact: Write down all the facts as stated. Do not filter yet. The purpose is to get everything on paper so you can separate facts from legal questions in the next step.`,
          `Step 2 — Separate facts from legal questions: Go through your list and mark which items are pure facts and which raise a legal question. "The contract was signed on 1 January" is a fact. "Whether the contract is enforceable without consideration" is a legal question.`,
          `Step 3 — Frame the primary legal question: Write a single sentence that states the legal question in the form: "Whether [legal right/obligation/test] applies to [the specific facts] under [the applicable statute and section]."`,
          `Step 4 — Identify any sub-issues: Ask whether the primary question can only be answered after resolving a preliminary question. List all sub-issues in logical order — you must research them in sequence.`,
          `Step 5 — Validate the framing: Ask yourself: if a court were to write the issue at the start of its judgment, would it use this framing? If you cannot answer yes, reframe it.`,
        ],
        appliedExample: `For the topic "${topic}", the legal issue can be framed as follows: Whether the rights, obligations, and remedies arising under ${ctx.sections} of the ${ctx.statute} are applicable to the specific facts of this matter, and if so, what the governing legal standard requires. The sub-issues include: (i) whether the jurisdictional requirements under the relevant provisions are satisfied; (ii) whether any procedural conditions precedent have been fulfilled; and (iii) whether the available case law from the Supreme Court and High Courts supports the claimed position. The leading cases to examine at Stage 4 will include: ${ctx.cases}.`,
        commonMistakes: [
          `Starting research before framing the issue: This is the most common error. The student receives a problem and immediately opens SCC Online or Google. The consequence is that they search without a clear target — they find 50 cases that are vaguely related but cannot explain why any of them actually answers the question. Senior advocates never search without a precise issue statement because every word in the issue determines the search terms they use.`,
          `Framing the issue too broadly: Writing "the issue is about employment law" is not an issue statement — it is a subject category. A proper issue must contain the legal test, the statute, and the specific fact pattern. "The issue is whether the dismissal of an employee without a domestic inquiry violates Section 25F of the Industrial Disputes Act, 1947" is a legal issue. Broad framing leads to research that covers an entire area of law instead of the specific question.`,
          `Confusing factual disputes with legal questions: Not every factual disagreement raises a legal issue. If two parties dispute when a contract was signed, that is a factual dispute for trial. The legal issue is what the consequence of that fact is under the applicable contract law. Students often spend hours researching the factual question instead of the legal one.`,
          `Failing to identify sub-issues: Some research problems involve multiple legal questions that must be answered in sequence. Missing a sub-issue means the final conclusion will be incomplete. Always ask: are there any preliminary questions that must be resolved before the main question can be answered?`,
        ],
        practicalTips: [
          `Write the issue in one sentence before touching any statute or case. If you cannot write it in one sentence, you do not understand the problem yet. Come back to the facts and try again.`,
          `Professors and courts expect issues framed as legal questions, not factual summaries. Compare: "The issue is whether the accused committed theft" (wrong) with "The issue is whether the taking of property without consent, in the circumstances alleged, constitutes theft under Section 303 of the Bharatiya Nyaya Sanhita, 2023" (correct).`,
          `Senior advocates keep a "issues list" for every brief. They add to it as new facts emerge and cross off issues as research resolves them. Start this practice now — it organises your research and prevents you from forgetting a sub-issue.`,
          `The issue statement is also your research brief. Every word in it becomes a search keyword. "Section 303 BNS 2023 theft without consent" gives you more targeted results than "theft law India."`,
        ],
        checklist: [
          '✓ I have written the primary legal issue as a single precise sentence',
          '✓ My issue statement names the applicable statute and section number',
          '✓ I have identified all sub-issues and ordered them logically',
          '✓ I have separated the factual disputes from the legal questions',
          '✓ I have confirmed the issue is framed as a legal question, not a factual summary',
          '✓ I could explain this issue statement to a colleague in one sentence',
        ],
        transitionSentence: `Now that the legal issue is precisely framed, we need to identify which Act of Parliament or State Legislature governs it. Without knowing the governing statute, you cannot read the operative provisions or find the relevant cases — Stage 2 makes Stage 1 actionable.`,
      },
      {
        coreQuestion: `Which Act of Parliament or State Legislature directly governs "${topic}", and which specific sections are most relevant?`,
        introduction: `Identifying the governing statute is not a formality — it is the decision that determines the entire direction of your research. Indian law has thousands of Central and State Acts, and many subjects are governed by multiple overlapping statutes. Choosing the wrong statute means reading the wrong provisions, finding the wrong cases, and giving advice under a law that does not apply. Junior lawyers frequently make this error because they rely on memory or internet searches instead of following a systematic process for statute identification.`,
        coreConcept: `The hierarchy of Indian law begins with the Constitution of India, which is the supreme law. Parliamentary legislation enacted under the Seventh Schedule (Union List and Concurrent List) governs most subjects of national importance. State legislation operates on the State List and, in some cases, the Concurrent List. Subordinate legislation — Rules, Regulations, Notifications, and Orders made under a parent Act — has the force of law within its limits but cannot exceed the scope of the parent Act. When researching a topic, you must identify: (1) the primary Central Act; (2) any State Act that supplements or overrides it within a particular State; (3) any Rules or Regulations in force under the Act; and (4) any relevant constitutional provisions that give the Act its foundational authority. In practice, advocates open the Ministry of Law and Justice website or PRS Legislative Research to identify the current version of the Act, including all amendments. Never rely on a text of the Act that is more than two years old without verifying whether it has been amended.`,
        workflow: [
          `Step 1 — Identify the subject matter from the issue statement: Use the legal issue you framed in Stage 1. The subject matter (contract, criminal, environment, labour, etc.) tells you which list of the Seventh Schedule governs and whether it is Central or State legislation.`,
          `Step 2 — Identify the primary Central Act: Using the subject matter, name the primary Parliamentary Act. Confirm the full title with the year of enactment. Examples: "The Payment of Wages Act, 1936" or "The Environment Protection Act, 1986."`,
          `Step 3 — Check for recent amendments: Use the Ministry of Law website or IndiaCode to verify the current version. Note any amendments that might have changed the relevant provisions since the original enactment.`,
          `Step 4 — Identify subordinate legislation: Check whether the Act has Rules, Regulations, or Notifications in force. These often contain the procedural requirements, time limits, and forms that determine the practical outcome.`,
          `Step 5 — Check for any relevant State Act: If the topic involves a Concurrent List subject, a State may have its own legislation. Confirm whether Central or State law prevails and under which provision.`,
        ],
        appliedExample: `For "${topic}", the governing statute is the ${ctx.statute}. The specific sections most relevant to this topic are ${ctx.sections}. You should also verify whether any Rules or Regulations have been framed under these provisions. The leading cases that interpret these sections include: ${ctx.cases}. Begin by downloading the current consolidated version of the ${ctx.statute} from the India Code portal to ensure you are working with the text that includes all amendments.`,
        commonMistakes: [
          `Going directly to case law without reading the statute: This is backwards. Cases interpret statutes. If you do not know what the statute says, you will misread what the case decided. A judgment that says "Section 25F requires a notice period" only makes sense if you have read Section 25F first. Always open the statute before opening SCC Online.`,
          `Using an outdated version of the Act: Parliament frequently amends legislation. An advocate who advises based on a section that was amended two years ago has given wrong advice. Always confirm the current version. The India Code portal (indiacode.nic.in) maintains updated consolidated Acts.`,
          `Missing subordinate legislation: The parent Act often states the principle while the Rules contain the procedure, time limits, and forms. Missing the Rules means you miss the practical requirements. For example, the Insolvency and Bankruptcy Code, 2016 requires reading the IBBI Regulations alongside the Code itself.`,
          `Confusing Central and State jurisdiction: Some subjects like labour law fall on the Concurrent List, meaning both Parliament and State Legislatures can legislate on them. In a State that has its own labour legislation, the State Act may prevail. Ignoring State law in such matters leads to incomplete advice.`,
        ],
        practicalTips: [
          `Always cite the full title of the Act including the year: "The Indian Contract Act, 1872" not "the Contract Act." Courts and examiners expect precision. The year matters because multiple Acts on the same subject may have been enacted at different times.`,
          `Senior advocates maintain a personal library of frequently used Acts. They keep physical or digital copies annotated with case references against each section. Start building this habit — annotate your copy of an Act with the key cases that interpret each section.`,
          `After identifying the primary Act, check the Statement of Objects and Reasons at the beginning of the Act. This tells you what Parliament intended the Act to achieve, which helps you interpret ambiguous provisions purposively.`,
          `Use the Ministry of Law and Justice website or IndiaCode to find consolidated Acts with all amendments incorporated. Never use a bare act from an unofficial source without verifying it against the official text.`,
        ],
        checklist: [
          '✓ I have named the primary governing Act with full title and year',
          '✓ I have confirmed I am using the current amended version of the Act',
          '✓ I have identified the 3-5 sections most directly relevant to the legal issue',
          '✓ I have checked whether any Rules or Regulations are in force under the Act',
          '✓ I have verified whether any State legislation applies alongside the Central Act',
          '✓ I have noted the constitutional provision (if any) that gives the Act its authority',
        ],
        transitionSentence: `With the governing statute identified and its relevant sections located, we are now ready to read those provisions word by word. Stage 3 is about understanding exactly what the statute says — not what a commentary says it says, but what the Parliament actually enacted.`,
      },
      {
        coreQuestion: `What do the exact words of the relevant sections of the ${ctx.statute} say, and what is their legal significance?`,
        introduction: `Reading the bare act is a discipline that distinguishes professionally trained lawyers from those who have merely read about law. Commentaries, textbooks, and online summaries all interpret the statute — they tell you what someone else thinks it means. The statute itself tells you what Parliament enacted. Courts are bound by the statutory text, not by academic commentary. When you appear before a judge, you must be able to open the Act at the relevant section and read the exact words. If you have not read those words yourself, you are building your argument on someone else's reading — which may be wrong, outdated, or incomplete.`,
        coreConcept: `Reading a statute professionally requires a specific sequence. Start with the Definitions section (usually Section 2 or Section 3 of the Act). Every defined term used in the operative provisions has a specific legal meaning that may differ from its ordinary meaning. Missing a definition is one of the most common reasons legal arguments fail. Next, read the operative provision — the section that creates the right, imposes the obligation, or grants the remedy. Then read any proviso (a clause beginning with "provided that") — a proviso carves out an exception to the main rule and often reverses what the main section appears to say. Finally, read any explanation appended to the section, which clarifies ambiguous terms. Also check Section 2 of the General Clauses Act, 1897, which applies to all Central legislation and defines terms like "person," "month," and "writing." When reading, underline operative words and ask: what must be proved? What is the threshold? What is the consequence of breach? What is the available remedy?`,
        workflow: [
          `Step 1 — Read the Definitions section first: Look up every defined term that appears in the operative section. Write down the statutory definition of each term. This tells you the precise meaning Parliament intended, which may differ from the ordinary meaning.`,
          `Step 2 — Read the operative section word by word: Do not skim. Read every word. Mark the operative verbs (the words that create the legal obligation or right), the subject (who is obligated or entitled), and the object (what is owed or prohibited).`,
          `Step 3 — Identify and read every proviso: A proviso modifies or creates an exception to the main rule. Read it carefully because it may restrict, expand, or reverse what the main section appears to say.`,
          `Step 4 — Read any cross-referenced sections: Operative sections often refer to other sections. For example, "as defined under Section 3" or "subject to the provisions of Section 15." Follow every cross-reference and read those sections too.`,
          `Step 5 — Note the elements: Break the section into its individual legal elements — the conditions that must all be satisfied for the section to apply. Write these as a numbered list. This list becomes the framework for your IRAC application in Stage 6.`,
        ],
        appliedExample: `For "${topic}" under the ${ctx.statute}, the relevant sections are ${ctx.sections}. Begin by locating the Definitions section of the Act and reading the definitions of every key term used in these provisions. Then read each operative section word by word, identifying the elements that must be satisfied. Pay particular attention to any proviso or exception that limits the scope of the main provision. Note the penalty or remedy provisions as well — these tell you the legal consequences of a breach and the form of relief available to the aggrieved party. The cases in ${ctx.cases} will show how courts have interpreted specific words and phrases in these provisions.`,
        commonMistakes: [
          `Reading the commentary before the bare act: Many students open Mulla on the Transfer of Property Act before opening the Transfer of Property Act itself. The result is that they understand the commentator's interpretation without knowing whether the statutory text actually supports it. Commentaries can be wrong, outdated, or written for a different edition of the Act. Read the statute first, form your own reading, and then use the commentary to verify or challenge it.`,
          `Ignoring provisos and exceptions: A proviso is the most powerful clause in a statute because it creates an exception to what appears to be a clear rule. Ignoring a proviso means you have misread the section. For example, under Section 73 of the Indian Contract Act, 1872, damages are available for breach of contract — but the proviso requires that the damages must have been in the reasonable contemplation of the parties. Missing the proviso means missing the key limitation on liability.`,
          `Not reading definitions: Many statutory terms have specific meanings that differ from everyday usage. "Person" under the General Clauses Act includes companies, associations, and bodies of individuals. "Writing" includes print. Missing these definitions leads to misapplying the section to parties or situations it was not intended to cover.`,
          `Reading only the operative section and ignoring related sections: Statutes are coherent wholes. A section on liability may be qualified by a section on defences. A section on penalty may be subject to a separate limitation section. Reading in isolation produces an incomplete and sometimes incorrect understanding of the law.`,
        ],
        practicalTips: [
          `Mark your copy of the Act as you read. Write the case names next to the sections they interpret. Over time, your annotated copy becomes one of your most valuable research tools — every future matter involving the same Act benefits from your previous annotations.`,
          `When reading a complicated section, rewrite it in plain English in the margin. If you cannot rewrite it simply, you have not understood it. The test of whether you truly understand a statutory provision is whether you can explain it to someone without legal training.`,
          `Professors expect you to cite the exact section number, not just the Act. "Under the Indian Contract Act" is insufficient. "Under Section 73 of the Indian Contract Act, 1872, read with the proviso thereto" shows that you have actually read the section.`,
          `Keep track of which sections you have read and which remain. Complex Acts may have 100 or more sections. Maintain a reading list and check off sections as you complete them. This prevents the error of concluding your research before you have read all the relevant provisions.`,
        ],
        checklist: [
          '✓ I have read the Definitions section and noted every relevant defined term',
          '✓ I have read the operative section word by word and identified its elements',
          '✓ I have read every proviso and exception and understood how they modify the main rule',
          '✓ I have followed every cross-reference in the operative section',
          '✓ I have broken the section into its individual legal elements as a numbered list',
          '✓ I have noted the penalty or remedy provisions and the threshold for their application',
          '✓ I can explain what the section requires in plain English without referring to any commentary',
        ],
        transitionSentence: `With the statutory text understood at the word level, we are ready to find the judgments that interpret it. Stage 4 is about discovering how the Supreme Court and High Courts have applied this exact statutory language to real facts — which is how we know what the provision means in practice.`,
      },
      {
        coreQuestion: `Which Supreme Court and High Court judgments most directly interpret the relevant provisions of the ${ctx.statute} as applied to "${topic}"?`,
        introduction: `Finding the right cases is one of the most practically important research skills a lawyer develops. The wrong cases — cases that are overruled, cases from lower benches that conflict with higher benches, or cases that deal with superficially similar but legally distinct facts — can destroy an otherwise sound argument. Indian courts produce thousands of judgments every year, and the challenge is identifying the small number that actually establish binding authority on the specific question you are researching. Most junior lawyers find either too many cases (and cannot prioritise them) or too few (and miss the key authority).`,
        coreConcept: `Indian law operates on the doctrine of binding precedent under Article 141 of the Constitution of India, which provides that the law declared by the Supreme Court shall be binding on all courts within India. This means that Supreme Court judgments on a point of law bind every High Court, District Court, and Tribunal in the country. Within the Supreme Court, bench strength determines priority: a Constitution Bench (5 or more judges) overrides a 3-judge bench, which overrides a 2-judge bench on the same point of law. High Court judgments bind courts within that High Court's jurisdiction but are only persuasive authority outside it. When you find a High Court judgment, you must always check whether the Supreme Court has subsequently addressed the same point — the Supreme Court's view will prevail. For research purposes, use SCC Online (subscriber) or IndianKanoon (free). Search by section number and Act name: "Section 25F Industrial Disputes Act." Always check whether the case has been affirmed, reversed, or overruled using SCC Online's case history feature or by searching for the case name + "overruled."`,
        workflow: [
          `Step 1 — Search by section number and Act name: On SCC Online or IndianKanoon, search for the exact section number and Act name you identified in Stage 3. This gives you cases that specifically interpret the provision.`,
          `Step 2 — Prioritise by bench strength: From your search results, identify Constitution Bench decisions first (5 or more judges). Note the case name, year, citation, and bench composition. These are your primary authorities.`,
          `Step 3 — Check for subsequent developments: For every case you identify, search for it by name on SCC Online to see if it has been affirmed, overruled, or distinguished by a later bench. A case overruled by a larger bench cannot be cited as authority.`,
          `Step 4 — Read the headnote and the holding: Before reading the full judgment, read the headnote and the final ruling to confirm the case actually addresses your specific question. Discard cases whose facts are too different from your problem.`,
          `Step 5 — Shortlist 3-5 cases: From your research, select the 3-5 most directly relevant and authoritative cases. These should include at least one Supreme Court judgment and any relevant High Court decisions that apply the law in your jurisdiction.`,
        ],
        appliedExample: `For "${topic}" under the ${ctx.statute}, begin your case search by entering the section numbers ${ctx.sections} on SCC Online or IndianKanoon. The leading cases that have interpreted these provisions include: ${ctx.cases}. For each case, note the bench composition, the specific provision interpreted, and the legal rule laid down. Check whether any of these cases has been subsequently affirmed or qualified by a larger bench. Prioritise Supreme Court Constitution Bench decisions above all others.`,
        commonMistakes: [
          `Citing a case without checking its current status: A judgment that has been overruled is not merely wrong — citing it can undermine your entire argument and damage your credibility before a court or examiner. Before citing any case, run a search for "case name + overruled" on SCC Online. This takes two minutes and is non-negotiable professional practice.`,
          `Treating High Court decisions as binding across India: A Delhi High Court judgment on a point of law is binding only on courts within the Delhi High Court's jurisdiction. It has no binding effect in Chennai or Mumbai. If you are advising a client in another State, you need the Supreme Court's view, not just a High Court judgment.`,
          `Ignoring bench strength within the Supreme Court: When two Supreme Court judgments on the same point appear to conflict, the judgment from the larger bench prevails. A 5-judge Constitution Bench decision overrides a 3-judge bench decision even if the 3-judge decision is more recent. Many students cite the more recent judgment without realising the Constitution Bench has settled the issue.`,
          `Finding cases but not reading the facts: You cannot cite a case usefully if you have not read its facts. The ratio of a case is derived from the legal question the court answered on the specific facts before it. A case that appears to support your argument may be distinguishable on facts. Always read the facts section before using a case.`,
        ],
        practicalTips: [
          `Use section numbers as your primary search terms, not topic keywords. "Section 482 BNSS 2023" gives you more targeted results than "anticipatory bail India." Topic keywords return too many results; section numbers filter them immediately.`,
          `In competitive examinations and moots, always cite cases with full citation: case name, year, court, volume, and page. "Maneka Gandhi v Union of India (1978) 1 SCC 248 — 7-judge bench" shows mastery. "The Maneka Gandhi case" does not.`,
          `Create a case chart for every research project. Columns: Case name, Court, Year, Bench, Provision interpreted, Ratio, Still good law (yes/no). This chart becomes your reference when writing the research memorandum.`,
          `IndianKanoon is free and useful for initial searches. SCC Online has case history features (tracing a case through appeals and subsequent mentions) that IndianKanoon does not. If your institution has SCC Online access, use it for verification.`,
        ],
        checklist: [
          '✓ I have searched for cases using the exact section number and Act name',
          '✓ I have identified at least one Supreme Court judgment directly on point',
          '✓ I have noted the bench composition of every case I intend to cite',
          '✓ I have verified that none of the cases I plan to cite has been overruled',
          '✓ I have read the facts section of every case I plan to cite',
          '✓ I have created a case chart with the ratio of each case clearly noted',
          '✓ I have checked for any Constitution Bench decision that supersedes the cases I found',
        ],
        transitionSentence: `With the key cases identified and shortlisted, Stage 5 requires us to analyse each judgment carefully — extracting the binding ratio, understanding its limits, and assessing whether it applies to our specific facts. Finding cases and understanding them are two different skills.`,
      },
      {
        coreQuestion: `What is the ratio decidendi of the leading case on "${topic}", and does it govern the specific facts of this research problem?`,
        introduction: `Case analysis is where most students reveal whether they have truly understood the law or merely collected citations. The difference between a student who can say "this case held X" and one who can say "the ratio of this case, which requires the court to find Y on facts Z, applies to our problem because our facts satisfy conditions Y and Z" is the difference between a research assistant and a lawyer. Courts do not cite cases for their outcomes — they cite cases for their ratio decidendi, the legal rule that the court applied to reach the outcome. Understanding this distinction is fundamental.`,
        coreConcept: `Ratio decidendi is the legal principle that is necessary to the decision in the case — the rule without which the court could not have reached the conclusion it did. Obiter dicta are statements made in passing that are not essential to the decision. Only ratio is binding under Article 141. To identify the ratio, you must: (1) read the facts as the court understood them; (2) identify the precise legal question the court was deciding; (3) find the rule the court applied to answer that question; and (4) confirm that the rule was necessary — not merely helpful — to the outcome. Courts may also distinguish a case: they find that the ratio of a previous case does not apply because the facts of the current case are materially different. Distinguishing is not overruling — the previous case remains good law, but it simply does not govern the current situation. Advocates use distinguishing to argue that a case their opponent cites does not apply to the present facts. A chain of authority is built by showing that multiple decisions, each with its own ratio, collectively establish a consistent rule. When ratios from different cases conflict, bench strength determines which prevails.`,
        workflow: [
          `Step 1 — Read the facts as the court framed them: Every judgment begins with a statement of facts. Read this carefully — the ratio applies only to facts of the kind the court was deciding. Facts you regard as similar may be legally distinct.`,
          `Step 2 — Identify the precise legal question the court decided: Courts often frame the issue themselves at the start of their analysis. If they do not, frame it from the facts and the holding. This is the question to which the ratio is the answer.`,
          `Step 3 — Extract the ratio: Find the paragraph(s) where the court states the legal rule and applies it to the facts. The ratio is the rule that follows from the court's reasoning — not the final order, but the principle that produced the final order.`,
          `Step 4 — Assess obiter dicta: Identify any statements the court made that were not necessary to the decision. These are persuasive but not binding. Note them separately — they may still be useful to your argument even though they are not binding.`,
          `Step 5 — Apply the ratio to your facts: Ask: are the material facts of our problem sufficiently similar to the facts in the case for the ratio to govern? If yes, cite the case directly. If not, consider whether the case can be distinguished.`,
        ],
        appliedExample: `For "${topic}", the leading cases are: ${ctx.cases}. For each case, perform the following analysis: read the facts as stated by the court; identify the specific legal question the court was answering; extract the paragraph(s) that state the binding rule; and assess whether the facts of "${topic}" are sufficiently similar for the ratio to apply. If the facts are materially different, note how the case can be distinguished and whether another case with closer facts exists.`,
        commonMistakes: [
          `Treating the final order as the ratio: The ratio is not the outcome ("the appeal was allowed") — it is the legal principle that produced the outcome. Students who cite a case for its result without understanding the rule that produced it cannot explain why the case applies to different but similar facts. They cannot argue by analogy. They cannot distinguish it when opposing counsel raises it.`,
          `Citing obiter dicta as binding law: Obiter statements are influential but not binding. When a Supreme Court judge writes that "it would seem" or "we need not decide this question but observe that" — those are obiter. Citing them as settled law is a significant error, particularly in examinations and court proceedings.`,
          `Not reading the facts before citing the case: A case that appears to support your argument may be distinguishable because the court was deciding a materially different fact pattern. This error is most common when students rely on headnotes rather than reading the judgment itself. Headnotes are summaries, not the ratio — they can oversimplify or mislead.`,
          `Ignoring conflicting cases: Research that finds only cases supporting one side and ignores contrary authority is incomplete and professionally dangerous. If there are cases that cut against your argument, you must find them — because opposing counsel certainly will. Address contrary authority head-on and explain why it does not govern or should be distinguished.`,
        ],
        practicalTips: [
          `When reading a judgment, use a highlighter or annotation tool. Yellow for facts; green for the legal issue; pink for the ratio; blue for obiter. This forces you to actively classify every paragraph rather than passively reading and hoping to remember.`,
          `The ratio can usually be found in the paragraph immediately before or after the court says "we therefore hold" or "in our view, the correct legal position is." These signal phrases indicate that the court is about to state the rule.`,
          `In competitive examinations, showing that you can identify ratio vs. obiter is a differentiating skill. Most students simply cite cases. A student who can say "the ratio of this case, as distinguished from the obiter observation in paragraph 42, requires..." demonstrates a level of legal analysis that examiners notice.`,
          `Build a ratio statement for each case you cite: "In [case name] ([year]), a [bench size]-judge bench of the Supreme Court held that [the ratio in one sentence]." Write this out for every case in your shortlist. This exercise forces you to be precise and makes writing the research memorandum much faster.`,
        ],
        checklist: [
          '✓ I have read the facts as stated by the court in each case I am citing',
          '✓ I have identified the precise legal question each court was deciding',
          '✓ I have extracted the ratio decidendi of each case in one sentence',
          '✓ I have identified any obiter statements and noted that they are not binding',
          '✓ I have assessed whether the facts of my problem are sufficiently similar to apply the ratio',
          '✓ I have noted any cases that conflict with my argument and considered how to address them',
          '✓ I have written a ratio statement for each case in the form: "In [case] ([year]), [bench]-judge bench held that [ratio]"',
        ],
        transitionSentence: `With the ratio extracted and assessed, we are now ready to perform the most critical step in legal research: applying the statute and the case law to the specific facts of this problem. Stage 6 is where legal knowledge becomes legal analysis.`,
      },
      {
        coreQuestion: `How does ${ctx.sections} of the ${ctx.statute}, read with the case law, resolve the specific facts raised by "${topic}"?`,
        introduction: `Application is the hardest step for most law students because it requires them to do something they have never been formally taught: translate abstract legal rules into concrete conclusions about specific facts. Reading the law and knowing the cases is preparation. Application is performance. It is the step that courts, clients, and examiners are actually evaluating. A research memorandum that states the law correctly but fails to apply it to the facts is incomplete — it answers a different question from the one that was asked. The IRAC method (Issue, Rule, Application, Conclusion) is the professional framework for ensuring that every piece of legal analysis is structured, complete, and logically sound.`,
        coreConcept: `IRAC stands for Issue, Rule, Application, Conclusion. The Issue is the specific legal question from Stage 1. The Rule is the statutory provision and case ratio from Stages 2-5. The Application is the step-by-step matching of facts to the elements of the rule. The Conclusion follows from whether all elements are satisfied. Application is done element by element: take each element of the statutory provision (the list you created in Stage 3), and ask whether the specific facts satisfy it. If an element is clearly satisfied, state that and move on. If an element is disputed or ambiguous, analyse it in depth — this is where the case law from Stages 4 and 5 is most useful. Do not skip facts that do not fit neatly into the rule — address them. Courts are not impressed by analysis that ignores inconvenient facts. A complete application acknowledges difficulty where it exists and explains the legal position despite that difficulty.`,
        workflow: [
          `Step 1 — State the Issue (from Stage 1): Begin with the precise legal question. Write it out in full. This anchors your analysis and confirms you are answering the right question.`,
          `Step 2 — State the Rule: Cite the specific statutory provision (section number and Act) and the binding case ratio. Write the rule clearly in one or two sentences: "Under Section X of the Y Act, Z must be established."`,
          `Step 3 — List the Elements: Break the rule into its individual elements — the conditions that must all be satisfied. Number them. This is the checklist you apply to the facts.`,
          `Step 4 — Apply Each Element to the Facts: For each element, state: (a) what the element requires; (b) what the facts show; and (c) whether the element is satisfied, disputed, or not satisfied. Use transitional phrases: "The first element requires... In the present case, the facts show... Therefore, this element is satisfied/not satisfied because..."`,
          `Step 5 — State the Conclusion: After completing the application for all elements, state whether the overall legal test is satisfied and what the legal consequence is. Begin with the answer: "Based on the above, [the legal conclusion]."`,
        ],
        appliedExample: `Applying IRAC to "${topic}": The Issue is the legal question framed in Stage 1. The Rule is derived from ${ctx.sections} of the ${ctx.statute} and the ratio in ${ctx.cases}. The Elements are the conditions stated in the relevant provisions. The Application requires examining each element against the specific facts of this topic and determining whether they are satisfied. The Conclusion states whether the statutory test is met and what legal consequence follows.`,
        commonMistakes: [
          `Jumping from the rule directly to the conclusion without the application step: This produces analysis like "Section 73 of the Contract Act allows damages for breach. Therefore, the plaintiff is entitled to damages." This skips the entire analysis of whether the statutory conditions for damages (breach, loss, causation, reasonable contemplation) are satisfied on the specific facts. Courts and examiners will reject this as conclusory reasoning.`,
          `Ignoring facts that do not support the conclusion: Students often present only the facts that favour their conclusion and hope the examiner does not notice the ones that cut the other way. This is both bad analysis and bad professional practice. Advising a client to proceed without disclosing adverse facts could constitute professional negligence. Good analysis confronts adverse facts and explains why they do not change the overall conclusion, or acknowledges that they do.`,
          `Applying the ratio of a case without checking whether the facts are sufficiently similar: A case ratio is derived from specific facts. If the facts of your problem are materially different, the ratio does not automatically apply. You must explicitly compare the facts. For example, if a contract case ratio was decided on facts involving commercial parties, it may not apply in the same way to consumer contracts.`,
          `Confusing application with argument: Application is a logical analysis of whether the legal test is satisfied. It is not advocacy. In a legal memorandum, the purpose is to identify the correct legal position, not to win an argument. Students who write application as if they are writing a one-sided submission miss the point of the analysis step.`,
        ],
        practicalTips: [
          `Write out the elements as a numbered list before you begin the application. Then go through them one by one. This prevents you from missing an element and ensures your analysis is complete.`,
          `Use transitional phrases consistently: "The first element requires... The facts show... Therefore..." These phrases signal to the reader that you are performing structured legal analysis, not just listing points.`,
          `When an element is satisfied clearly, state it briefly and move on. Spend the most analysis time on the element(s) that are disputed or difficult — that is where the legal question actually lies.`,
          `Senior advocates write their IRAC analysis before they finalise their opinion. They use it internally to check their own logic before presenting a conclusion to the client. If the application does not clearly support the conclusion, they revisit the rule and the cases.`,
        ],
        checklist: [
          '✓ I have stated the legal issue at the start of my application',
          '✓ I have cited the specific statutory rule with section number and Act',
          '✓ I have cited the binding case ratio with case name, year, and bench',
          '✓ I have broken the rule into its individual elements as a numbered list',
          '✓ I have applied each element to the specific facts one by one',
          '✓ I have addressed facts that cut against my conclusion, not just facts that support it',
          '✓ My conclusion follows logically from the application, not from the result I prefer',
        ],
        transitionSentence: `With the application complete, the final stage is to state the reasoned legal conclusion clearly and professionally. Stage 7 is about communicating what your research has established — which is what clients, courts, and professors ultimately require.`,
      },
      {
        coreQuestion: `What is the most legally defensible conclusion for "${topic}", supported by statute and binding case authority?`,
        introduction: `A conclusion is not a summary of what you have researched. It is a specific, reasoned answer to the specific legal question you were asked to resolve. After six stages of research, you now have the issue, the statute, the provisions, the cases, the analysis, and the application. Stage 7 is where you distil all of that into a professional legal opinion. This is where most students fail — not because they do not have the right answer, but because they cannot state it with precision, confidence, and authority. A legal conclusion that says "it may depend on the circumstances" or "there are arguments on both sides" without resolving them is not a legal opinion — it is a fence-sitting exercise that is of no use to anyone.`,
        coreConcept: `A professional legal conclusion has four components. First, the answer: state clearly whether the legal question is answered in the affirmative or negative. Do not begin with background — lead with the answer. Second, the legal basis: cite the specific statutory provision and the binding case authority that supports the answer. Third, any qualification: if there is genuine uncertainty (conflicting benches, unsettled law, missing facts), acknowledge it specifically — but also state which way the current weight of authority leans. Fourth, next steps: if the conclusion requires further action (such as gathering additional evidence, filing an application within a limitation period, or obtaining an expert opinion), state this clearly. The difference between academic legal writing and professional legal writing is that professional writing is action-oriented — it tells the reader what to do, not just what the law says.`,
        workflow: [
          `Step 1 — Lead with the answer: Write the conclusion first. "Based on the above analysis, [the answer to the legal question]." Do not bury the conclusion at the end of three paragraphs.`,
          `Step 2 — State the statutory basis: Cite the specific section and Act that supports the conclusion. "This conclusion is based on Section X of the Y Act, which provides that [operative words]."`,
          `Step 3 — Cite the case authority: Name the binding judgment(s) that establish the legal rule applied in reaching this conclusion. State the ratio briefly.`,
          `Step 4 — Address any qualification: If there is conflicting authority or a genuine factual ambiguity, acknowledge it. "The contrary view in [case] may be distinguished because..." or "If the facts were found to be X rather than Y, the conclusion would differ because..."`,
          `Step 5 — State the recommended next steps: Tell the reader what should happen next. Filing a petition, gathering evidence, obtaining a valuation, complying with a time limit — whatever the legal position requires.`,
        ],
        appliedExample: `For "${topic}": The legal conclusion, based on the analysis performed in Stages 1-6, is that [the answer]. This is established by ${ctx.sections} of the ${ctx.statute} and the ratio in ${ctx.cases}. Any qualification or contrary authority should be addressed by noting which bench decided it and whether it has been followed or distinguished by subsequent decisions. The recommended next steps depend on the purpose of the research — whether advising a client, preparing a brief, or writing an academic paper.`,
        commonMistakes: [
          `Hedging without reason: Writing "it may or may not be the case" when the law is actually clear is a failure of professional courage. Lawyers are paid to give clear opinions. If the law is clear, say so. If it is genuinely uncertain, explain exactly why — which bench conflicts with which bench, on what point, and which way the weight of current authority leans.`,
          `Burying the conclusion at the end: In professional legal writing, the conclusion comes first. The BLUF principle (Bottom Line Up Front) applies to legal opinions, court submissions, and client advice alike. Judges and clients are busy. They read the first paragraph to find the answer and then decide whether to read the rest. If your answer is on page 4, they will have formed their own view before reaching it.`,
          `Giving an opinion without citing authority: A conclusion that says "in my opinion, the plaintiff will succeed" without citing the specific statutory provision and binding case authority is not a legal opinion — it is a personal view. Legal opinions derive their authority from the law, not from the advocate's personal assessment.`,
          `Forgetting to identify next steps: Research is a means to an end. A client does not need a research paper — they need to know what to do. Always end with a clear statement of what the legal position requires in practical terms: file within X days, gather Y evidence, comply with Z notice requirement.`,
        ],
        practicalTips: [
          `Write the conclusion before you write the analysis. Professional advocates know their answer from the beginning — the analysis is the reasoning that supports and tests that answer. Starting with a provisional conclusion helps you identify the exact legal issues your analysis needs to address.`,
          `Review your conclusion against the original issue statement from Stage 1. If the conclusion does not directly answer the question asked in Stage 1, you have answered the wrong question. The conclusion must close the loop opened by the issue.`,
          `Courts expect conclusions expressed in the language of the statute. Do not say "the employer was unfair." Say "the employer's action constituted an unfair labour practice within the meaning of Section 25T of the Industrial Disputes Act, 1947." Statutory language in the conclusion demonstrates that you have grounded your opinion in the law, not in general notions of fairness.`,
          `After completing your research, review all seven stages to ensure internal consistency. The statute cited in Stage 2 should match the sections read in Stage 3. The cases found in Stage 4 should be the ones analysed in Stage 5. The IRAC in Stage 6 should use the elements extracted from the statute in Stage 3. Inconsistency across stages is a sign of disorganised research.`,
        ],
        checklist: [
          '✓ My conclusion directly answers the legal question stated in Stage 1',
          '✓ I have led with the answer, not with a summary of my research',
          '✓ I have cited the specific statutory provision that supports the conclusion',
          '✓ I have cited the binding case authority with case name, year, and bench',
          '✓ I have addressed any conflicting authority and explained its weight',
          '✓ I have stated the recommended next steps arising from the legal position',
          '✓ My conclusion is consistent with the statute, the cases, and the IRAC analysis',
          '✓ I can state the conclusion and its legal basis in two sentences without notes',
        ],
        transitionSentence: ``,
      },
    ];

    return {
      intro: {
        areaOfLaw: ctx.area,
        explanation: `This question concerns "${topic}" under ${ctx.area} in India. The primary statute is the ${ctx.statute}, which governs the rights, duties, and remedies relevant to this topic. Research on this topic requires careful reading of ${ctx.sections} and analysis of the leading cases that interpret those provisions.`,
        importance: `Getting "${topic}" wrong can result in procedural defeat, loss of client rights, or an unenforceable order. In practice, incorrect statutory identification or reliance on an overruled case can expose an advocate to professional liability — which is why precise statutory and judicial analysis is non-negotiable.`,
        mentorIntroduction: `Good question — "${topic}" is exactly the kind of issue where most junior lawyers make avoidable errors by jumping straight to Google instead of following a structured research method. The governing statute is the ${ctx.statute}, and the leading cases on this topic have laid down specific rules you must know before you can advise anyone. Over the next seven stages, I am going to walk you through the same research methodology I have used for 25 years at the Delhi High Court. By the end of this session, you will be able to research any legal question on this topic independently and professionally.`,
      },
      stages: STAGE_META.map((meta, index) => ({
        stepNumber: index + 1,
        title: stageTitles[index],
        coreQuestion: meta.coreQuestion,
        introduction: meta.introduction,
        coreConcept: meta.coreConcept,
        workflow: meta.workflow,
        appliedExample: meta.appliedExample,
        commonMistakes: meta.commonMistakes,
        practicalTips: meta.practicalTips,
        checklist: meta.checklist,
        transitionSentence: meta.transitionSentence,
      })),
      finalMemo: {
        legalIssue: `Whether "${topic}" gives rise to a specific legal right or obligation under ${ctx.statute}.`,
        areaOfLaw: ctx.area,
        governingStatutes: `${ctx.statute} — ${ctx.sections}`,
        relevantProvisions: `${ctx.sections} of the ${ctx.statute}`,
        leadingJudgments: ctx.cases,
        caseAnalysis: `Ratio and application of the leading cases to the specific question raised by "${topic}" under ${ctx.statute}.`,
        applicationToFacts: `Applying ${ctx.sections} of the ${ctx.statute} and the case authority to "${topic}" — the outcome turns on whether all statutory elements are satisfied on the specific facts.`,
        conclusion: `Based on ${ctx.statute} and the leading authorities (${ctx.cases}), "${topic}" is governed by specific statutory conditions whose satisfaction must be established on the facts.`,
        practicePoints: [
          'Always verify the current version of the statute — check for recent amendments and notifications.',
          'Prefer Supreme Court judgments over High Court decisions where both exist.',
          'Note the composition of the bench — a larger bench overrides a smaller bench.',
          'Date and sign your research notes — stale research is dangerous in practice.',
          'Always identify and read the sub-issues before committing to a conclusion on the main issue.',
        ],
      },
    };
  }

  private isBareActGreeting(message: string): boolean {
    const normalized = (message || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const greetings = [
      'hi',
      'hello',
      'hey',
      'good morning',
      'good evening',
      'good afternoon',
      'namaste',
      'how are you',
      'who are you',
      'what can you do',
    ];
    if (greetings.includes(normalized)) return true;

    // Check if the query is a greeting or identity question and doesn't ask about a specific section/provision
    const hasStatutoryRef = /\b(section|sec|article|art|chapter|ch|schedule|sch|provision|amendment)\b/i.test(normalized) || /\b\d+\b/.test(normalized);
    if (!hasStatutoryRef) {
      const hasGreetingWord = /\b(hi+|hello+|hey+|namaste|greetings|morning|evening|afternoon)\b/i.test(normalized);
      const hasIdentityPhrase = /\b(who are you|what can you do|what do you do|how can you help|your role|your purpose|introduce yourself)\b/i.test(normalized);
      if (hasGreetingWord || hasIdentityPhrase) {
        return true;
      }
    }

    return false;
  }

  async bareActAiBar(
    userId: string,
    body: {
      provisionText: string;
      history?: { role: 'user' | 'assistant'; content: string }[];
    },
  ) {
    void userId;
    const provisionText = String(body.provisionText || '').trim();
    if (!provisionText) {
      return { markdown: 'Please paste a Bare Act provision or ask a question to get started.', act: 'UNKNOWN', source: 'none', lowConfidence: false };
    }

    // 1. Check for Greetings
    if (this.isBareActGreeting(provisionText)) {
      const greetingResponse = `Hello! I am **Bare Act AI**, your statutory law assistant inside LEGATRIXON.\n\nI help you understand Bare Acts in simple language while preserving their legal meaning.\n\nI can explain:\n\n• Sections\n• Definitions\n• Clauses\n• Provisos\n• Explanations\n• Illustrations\n• Exceptions\n• Chapters\n• Schedules\n• Legal terminology used inside Bare Acts\n\nI answer only from the Bare Act database available in LEGATRIXON and do not provide legal opinions or case-based advice.\n\nHow can I help you today?`;
      return {
        markdown: greetingResponse,
        act: 'WELCOME',
        source: 'none',
        lowConfidence: false,
      };
    }

    // 2. Check for out-of-scope questions
    const normalizedQuery = provisionText.toLowerCase();
    const isWinCase = /\b(win|outcome|lose|verdict|judge\s+will|court\s+outcome|predict|succeed\s+in)\b/i.test(normalizedQuery) && /\b(case|suit|matter|trial|appeal|litigation)\b/i.test(normalizedQuery);
    const isLegalAdvice = /\b(what\s+should\s+i\s+do|how\s+should\s+i|legal\s+strategy|legal\s+advice|should\s+i\s+file|recommend\s+filing|draft\s+a)\b/i.test(normalizedQuery);
    const isCaseLawQuery = /\b(case\s+law|precedent|judgment|judgement|ruling|supreme\s+court|high\s+court|landmark\s+case)\b/i.test(normalizedQuery);
    const isDraftingQuery = /\b(draft|write\s+a\s+contract|template\s+for|agreement\s+draft)\b/i.test(normalizedQuery);
    const isConstitutionalPhilosophy = /\b(philosophy|philosophical|foundation|origin|evolution|concept\s+of\s+equality|concept\s+of\s+justice)\b/i.test(normalizedQuery) && /\b(constitution|constitutional|equality|justice)\b/i.test(normalizedQuery);

    if (isWinCase) {
      return {
        markdown: `I specialize only in explaining Bare Act provisions. I cannot provide legal advice or predict legal outcomes. If you would like to understand a specific statutory provision, please mention the Act and Section.`,
        act: 'OUT_OF_SCOPE',
        source: 'none',
        lowConfidence: false,
      };
    }

    if (isLegalAdvice) {
      return {
        markdown: `My role is limited to explaining statutory provisions contained in Bare Acts. I cannot provide legal advice or recommendations.`,
        act: 'OUT_OF_SCOPE',
        source: 'none',
        lowConfidence: false,
      };
    }

    if (isCaseLawQuery) {
      return {
        markdown: `I specialize only in explaining Bare Act provisions. I cannot discuss case laws, precedents, or judgments. If you would like to understand a specific statutory provision, please mention the Act and Section.`,
        act: 'OUT_OF_SCOPE',
        source: 'none',
        lowConfidence: false,
      };
    }

    if (isDraftingQuery) {
      return {
        markdown: `I specialize only in explaining Bare Act provisions. I cannot draft legal documents. If you would like to understand a specific statutory provision, please mention the Act and Section.`,
        act: 'OUT_OF_SCOPE',
        source: 'none',
        lowConfidence: false,
      };
    }

    if (isConstitutionalPhilosophy) {
      return {
        markdown: `I specialize only in explaining Bare Act provisions. I cannot discuss general constitutional philosophy unless directly supported by the Bare Act text. If you would like to understand a specific statutory provision, please mention the Act and Section.`,
        act: 'OUT_OF_SCOPE',
        source: 'none',
        lowConfidence: false,
      };
    }

    // 3. Retrieval First Check
    const retrieval = await this.legalRetrievalService.retrieveLegalContext(provisionText, 10);
    const requestedActId = retrieval.detectedActId;
    const mismatched = requestedActId
      ? retrieval.provisions.some((provision) => provision.actId !== requestedActId)
      : false;

    if (mismatched || !retrieval.provisions || retrieval.provisions.length === 0 || (requestedActId && retrieval.detectedNumber && retrieval.provisions.length === 0)) {
      return {
        markdown: 'I could not find the requested provision in the available Bare Act database.',
        act: retrieval.detectedActName || 'UNKNOWN',
        source: 'none',
        lowConfidence: true,
      };
    }

    const orderedHits = retrieval.provisions.map((provision) => ({
      score: provision.score,
      text: provision.content,
      actName: provision.actName,
      shortName: retrieval.detectedActName || provision.actName,
      section: provision.section || null,
    }));

    const detectedActFull = retrieval.detectedActName || orderedHits[0]?.actName || 'Indian Law';
    const detectedActShort = detectedActFull.replace(/, \d{4}$/, '').substring(0, 32) || 'UNKNOWN';
    const provisionNumber = retrieval.detectedNumber;
    const provisionLabel = retrieval.detectedType === 'article' ? 'Article' : 'Section';
    const corpusContext = orderedHits.length > 0
      ? orderedHits.map((h, i) => {
          const label = h.score === 1 ? 'exact SQL match' : `similarity ${(h.score * 100).toFixed(0)}%`;
          return `[${i + 1}] ${h.actName} | ${h.section ? `${provisionLabel} ${h.section}` : 'General'} | ${label}\n${h.text}`;
        }).join('\n\n---\n\n')
      : '';

    const hasCorpus = corpusContext.length > 0;
    const source: 'corpus' | 'knowledge' | 'hybrid' = hasCorpus && retrieval.log.strategy === 'exact-sql' ? 'corpus' : hasCorpus ? 'hybrid' : 'knowledge';

    // 4. Strict Retrieval Grounding System Prompt
    const systemPrompt = 
      `You are Bare Act AI, a specialized statutory law assistant inside LEGATRIXON. Your only responsibility is helping users understand Bare Acts exactly as they are written.\n\n` +
      `ROLE AND BEHAVIOR:\n` +
      `- You are NOT a general legal assistant, chatbot, or research assistant.\n` +
      `- You make statutory provisions easy to understand without changing their legal meaning.\n` +
      `- You answer ONLY from the provided retrieved statutory text below.\n` +
      `- Every sentence you generate must be supported by the retrieved statutory text. Do not invent, assume, or infer anything. No creativity, speculation, or assumptions are allowed.\n` +
      `- NEVER discuss case laws, Supreme Court or High Court judgments, legal opinions, precedents, or legal strategies.\n` +
      `- Do not provide legal advice, do not predict court outcomes, do not suggest legal strategy, do not recommend filing cases, do not interpret evidence, and do not draft legal documents.\n` +
      `- Previous conversation memory is restricted. You must NOT use previous conversation memory or general LLM knowledge to answer. Answer ONLY from the retrieved statutory context provided in the current prompt.\n` +
      `- If the answer is not present inside the retrieved Bare Act text, you must return: 'I could not find the requested provision in the available Bare Act database.'\n\n` +
      `RETRIEVED STATUTORY CONTEXT:\n` +
      `${corpusContext}\n\n` +
      `RESPONSE FORMAT:\n` +
      `You MUST structure your response EXACTLY as follows, using the exact headers specified below. Do not deviate from this format under any circumstances:\n\n` +
      `## Provision\n` +
      `${detectedActFull}\n` +
      `${provisionLabel} ${provisionNumber || 'General'}\n` +
      `${orderedHits[0]?.section ? `Section ${orderedHits[0].section}` : 'General Statutory Provision'}\n` +
      `---\n` +
      `## Original Bare Act Text\n` +
      `${orderedHits[0]?.text || 'No original text available.'}\n` +
      `---\n` +
      `## Simple Explanation\n` +
      `[Rewrite the provision in plain English without changing its legal meaning, strictly grounded in the retrieved text]\n` +
      `---\n` +
      `## Clause-wise Breakdown\n` +
      `[Explain each clause of the provision separately, strictly based on the retrieved text]\n` +
      `---\n` +
      `## Important Legal Terms\n` +
      `[Explain difficult statutory words present in the provision]\n` +
      `---\n` +
      `## Related Sections\n` +
      `[Show related sections ONLY if they are present and retrieved in the provided statutory context. NEVER invent or search for related sections from memory. If no related sections are in the retrieved context, leave this section empty or omit it.]\n` +
      `---\n` +
      `## Source\n` +
      `${detectedActFull}\n` +
      `${provisionLabel} ${provisionNumber || 'General'}\n` +
      `LEGATRIXON Database`;

    const extractiveSystemPrompt = this.buildBareActExtractiveFallbackPrompt(corpusContext, detectedActFull);
    const history = Array.isArray(body.history)
      ? body.history.slice(-8).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      : [];

    const result = await this.bareActGenerateWithDegradation(
      systemPrompt,
      extractiveSystemPrompt,
      history,
      provisionText,
      hasCorpus,
      orderedHits,
      detectedActFull,
      provisionLabel,
      provisionNumber,
    );

    const lowConfidence = !hasCorpus || retrieval.log.confidence === 'low' || retrieval.log.confidence === 'none' || (result.degraded && retrieval.log.confidence !== 'high');

    return { markdown: result.markdown, act: detectedActShort, source, lowConfidence };
  }
  private async loadBareActDraftingSample(topic: string): Promise<string> {
    const samplesRoot = path.resolve(process.cwd(), 'corpus-data', 'Bare Act Samples');
    if (!fs.existsSync(samplesRoot)) return '';

    const topicTokens = topic.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 3);
    const files: Array<{ filePath: string; score: number }> = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
          continue;
        }
        const ext = path.extname(entry.name).toLowerCase();
        if (!['.pdf', '.txt', '.md', '.markdown'].includes(ext)) continue;
        const haystack = fullPath.toLowerCase();
        const score = topicTokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
        files.push({ filePath: fullPath, score });
      }
    };

    walk(samplesRoot);
    if (!files.length) return '';

    files.sort((a, b) => b.score - a.score || a.filePath.localeCompare(b.filePath));
    const selected = files.slice(0, 2);
    const excerpts: string[] = [];

    for (const item of selected) {
      try {
        const ext = path.extname(item.filePath).toLowerCase();
        let text = '';
        if (ext === '.pdf') {
          const pdfParse = require('pdf-parse');
          const parsed = await pdfParse(fs.readFileSync(item.filePath));
          text = String(parsed.text || '');
        } else {
          text = fs.readFileSync(item.filePath, 'utf-8');
        }
        const compact = text.replace(/\s+/g, ' ').trim();
        if (compact.length > 200) {
          excerpts.push(`--- Sample: ${path.relative(samplesRoot, item.filePath)} ---\n${compact.slice(0, 6000)}`);
        }
      } catch (error: any) {
        this.logger.warn(`Unable to read Bare Act drafting sample ${item.filePath}: ${error.message}`);
      }
    }

    return excerpts.join('\n\n');
  }
  private classifyDraftingIntent(request: string, topic: string, actName = '', sectionRef = '') {
    const raw = `${request} ${topic} ${actName} ${sectionRef}`.toLowerCase();
    const normalized = raw.replace(/[^a-z0-9§.\s-]/g, ' ').replace(/\s+/g, ' ').trim();

    const existingDoctrineMap: Array<[RegExp, string, string]> = [
      [/\bdeclaratory\s+relief\b|\bdeclaration\s+of\s+status\b|\bdeclaratory\s+decree\b/, 'Specific Relief Act, 1963', 'declaratory relief'],
      [/\bspecific\s+performance\b/, 'Specific Relief Act, 1963', 'specific performance'],
      [/\binjunctions?\b|\btemporary\s+injunction\b|\bpermanent\s+injunction\b/, 'Specific Relief Act, 1963', 'injunction'],
      [/\bres\s+judicata\b/, 'Code of Civil Procedure, 1908', 'res judicata'],
      [/\bestoppel\b/, 'Indian Evidence Act, 1872 / Bharatiya Sakshya Adhiniyam, 2023', 'estoppel'],
      [/\bconsideration\b/, 'Indian Contract Act, 1872', 'consideration'],
      [/\bmens\s+rea\b/, 'criminal law doctrine', 'mens rea'],
      [/\banticipatory\s+bail\b|\bbail\b/, 'Bharatiya Nagarik Suraksha Sanhita, 2023', 'bail'],
    ];

    const sectionMatch = normalized.match(/\b(section|sec\.?|s\.?|article|art\.?)\s*(\d+[a-z]?)\b/);
    if (sectionMatch || sectionRef) {
      return {
        code: 'ANALYSE_EXISTING_PROVISION',
        label: 'Analyse an existing statutory provision',
        shouldCreateNewAct: false,
        existingLaw: actName && actName !== 'the Act' ? actName : 'the identified Act',
        focus: sectionRef || `${sectionMatch?.[1] || 'section'} ${sectionMatch?.[2] || ''}`.trim(),
      };
    }

    if (/\bamend(?:ment)?\b|\bbill\b/.test(normalized) && /\bact\b|\bcompanies\b|\bconstitution\b|\bcode\b/.test(normalized)) {
      return { code: 'DRAFT_AMENDMENT_BILL', label: 'Draft an amendment Bill', shouldCreateNewAct: false, existingLaw: this.extractExistingActName(request) || actName || 'the existing Act', focus: 'amendment architecture' };
    }
    if (/\b(rule|rules)\b/.test(normalized)) return { code: 'DRAFT_RULES', label: 'Draft Rules', shouldCreateNewAct: false, existingLaw: actName || 'the parent Act', focus: topic };
    if (/\b(regulation|regulations)\b/.test(normalized)) return { code: 'DRAFT_REGULATIONS', label: 'Draft Regulations', shouldCreateNewAct: false, existingLaw: actName || 'the parent Act', focus: topic };
    if (/\bnotification\b/.test(normalized)) return { code: 'DRAFT_NOTIFICATION', label: 'Draft Notification', shouldCreateNewAct: false, existingLaw: actName || 'the enabling Act', focus: topic };
    if (/\bgovernment\s+order\b|\bg\.o\.\b/.test(normalized)) return { code: 'DRAFT_GOVERNMENT_ORDER', label: 'Draft Government Order', shouldCreateNewAct: false, existingLaw: actName || 'the enabling authority', focus: topic };
    if (/\bdefinition|definitions\b/.test(normalized)) return { code: 'DRAFT_DEFINITION', label: 'Draft Definitions', shouldCreateNewAct: false, existingLaw: actName || 'the relevant Act', focus: topic };
    if (/\bpenalt(?:y|ies)|punishment|fine|imprisonment\b/.test(normalized)) return { code: 'DRAFT_PENALTY', label: 'Draft Penalty provisions', shouldCreateNewAct: false, existingLaw: actName || 'the relevant Act', focus: topic };
    if (/\bschedule|form\b/.test(normalized)) return { code: normalized.includes('form') ? 'DRAFT_FORMS' : 'DRAFT_SCHEDULE', label: normalized.includes('form') ? 'Draft Forms' : 'Draft Schedules', shouldCreateNewAct: false, existingLaw: actName || 'the parent Act', focus: topic };
    if (/\bexplanation\b/.test(normalized)) return { code: 'DRAFT_EXPLANATION', label: 'Draft Explanations', shouldCreateNewAct: false, existingLaw: actName || 'the relevant provision', focus: topic };
    if (/\bproviso\b/.test(normalized)) return { code: 'DRAFT_PROVISO', label: 'Draft Provisos', shouldCreateNewAct: false, existingLaw: actName || 'the main provision', focus: topic };
    if (/\bsaving|savings\b/.test(normalized)) return { code: 'DRAFT_SAVING', label: 'Draft Saving clauses', shouldCreateNewAct: false, existingLaw: actName || 'the existing law', focus: topic };
    if (/\brepeal\b/.test(normalized)) return { code: 'DRAFT_REPEAL', label: 'Draft Repeal clauses', shouldCreateNewAct: false, existingLaw: actName || 'the existing law', focus: topic };
    if (/\bredraft|rewrite|improve|revise\b/.test(normalized)) return { code: 'IMPROVE_EXISTING_DRAFT', label: 'Improve or redraft an existing provision', shouldCreateNewAct: false, existingLaw: actName || 'the submitted draft/provision', focus: topic };

    for (const [pattern, law, doctrine] of existingDoctrineMap) {
      if (pattern.test(normalized)) {
        return { code: 'UNDERSTAND_EXISTING_DOCTRINE', label: 'Understand an existing legal doctrine', shouldCreateNewAct: false, existingLaw: law, focus: doctrine };
      }
    }

    if (/\b(specific\s+relief|contract\s+act|companies\s+act|constitution|cpc|civil\s+procedure|crpc|bnss|bns|ipc|evidence\s+act|transfer\s+of\s+property|limitation\s+act)\b/.test(normalized)) {
      return { code: 'UNDERSTAND_EXISTING_BARE_ACT', label: 'Understand an existing Bare Act', shouldCreateNewAct: false, existingLaw: this.extractExistingActName(request) || actName || topic, focus: topic };
    }

    if (/\bdraft\s+(a\s+)?(new\s+)?(act|bare\s+act|law|statute)\b|\bhow\s+to\s+(write|draft)\s+(a\s+)?(bare\s+act|act|law|statute)\b/.test(normalized)) {
      return { code: 'DRAFT_NEW_ACT', label: 'Draft a completely new Act', shouldCreateNewAct: true, existingLaw: '', focus: topic };
    }

    return { code: 'DRAFT_NEW_ACT', label: 'Draft a completely new Act', shouldCreateNewAct: true, existingLaw: '', focus: topic };
  }

  private extractExistingActName(request: string): string {
    const match = request.match(/\b([A-Z][A-Za-z\s&,-]+(?:Act|Code|Constitution)(?:,\s*\d{4})?)/);
    return match?.[1]?.trim() || '';
  }

  private buildExistingLawDraftingFallback(topic: string, intent: ReturnType<LegalIntelligenceService['classifyDraftingIntent']>, hasSample: boolean, sampleProfileText: string) {
    const focus = intent.focus || topic;
    const law = intent.existingLaw || 'the existing statutory framework';
    const isProvision = intent.code === 'ANALYSE_EXISTING_PROVISION';
    const isDoctrine = intent.code === 'UNDERSTAND_EXISTING_DOCTRINE';
    return {
      topic,
      draftingIntent: intent.code,
      draftingIntentLabel: intent.label,
      existingLaw: law,
      shouldCreateNewAct: false,
      learningObjective: isDoctrine
        ? `A Parliamentary Counsel would first locate ${focus} in existing law before asking whether any new drafting is required.`
        : isProvision
          ? `A Parliamentary Counsel would first read ${focus} as enacted text before attempting to imitate or redraft it.`
          : `A Parliamentary Counsel would first identify the parent law and enabling power before drafting ${focus}.`,
      overview: isDoctrine
        ? `${focus} is not automatically a new Act topic. It is an existing legal concept connected with ${law}, so the first lesson is to understand how the legislature already expresses the doctrine.`
        : isProvision
          ? `${focus} is an existing statutory provision, not a blank legislative field. We must study its placement, operative words, limits, and consequences before drafting anything similar.`
          : `This is not a request for a complete new Act. It is a targeted drafting task inside or under ${law}, so the lesson must stay inside that legal instrument's authority and structure.`,
      draftingPlan: [
        `Classify the task correctly: ${intent.label}.`,
        `Locate the legal home: ${law}.`,
        `Read the existing language before drafting: identify the subject, object, operative verb, condition, exception, and consequence.`,
        'Ask why the drafter placed this concept here: definition, right, remedy, procedure, power, or consequence.',
        'Only after that analysis should the student attempt a narrow analogous draft, not a complete Act.',
      ],
      arrangementOfSections: [],
      steps: [{
        stepNumber: 1,
        title: isDoctrine ? 'Locate the Existing Doctrine' : isProvision ? 'Read the Existing Provision as Drafted' : 'Identify the Parent Authority',
        instruction: isDoctrine
          ? `Before drafting, state where ${focus} presently sits in law and what legal function it performs. Do not invent a new Act title.`
          : isProvision
            ? `Break ${focus} into its drafting parts: who is addressed, what legal verb is used, what condition triggers it, and what legal effect follows.`
            : `Identify the parent Act, rule-making power, or authority that permits this drafting task. Do not draft beyond that enabling power.`,
        tip: isDoctrine
          ? 'Existing doctrines are drafted into Acts because the legislature is solving a defined remedial or procedural problem. If you miss that legal function, you will draft a fake statute instead of learning the convention.'
          : 'A drafter reads enacted language architecturally: placement controls scope, verbs control legal effect, exceptions control boundaries, and procedure controls fairness.',
        example: isDoctrine
          ? `For ${focus}, the student should first ask: is this a right, remedy, defence, procedure, discretion, or jurisdictional power under ${law}? That answer determines the drafting lesson.`
          : `If a provision says a court may grant a remedy, the verb may signals discretion; if it says a person shall do an act, the verb shall creates obligation. The drafting lesson changes with the verb.`,
      }],
      draftingPrinciples: [
        'The first professional drafting judgment is classification: new Act, amendment, rule, notification, provision, doctrine, or redraft. The wrong classification produces legally unreal documents.',
        hasSample ? `The specimen may teach structure (${sampleProfileText}), but it cannot convert an existing doctrine into a new Act.` : 'Existing law must be analysed before imitation; drafting without locating the parent law is not legislative drafting.',
      ],
      commonMistakes: [
        `Treating ${focus} as a blank topic for a new Act when it may already be governed by ${law}.`,
      ],
      practiceTask: isDoctrine
        ? `Write one sentence identifying where ${focus} exists in law and what function it performs. Do not draft a new Act title.`
        : isProvision
          ? `Write one sentence identifying the operative verb and legal effect in ${focus}. Do not rewrite the provision yet.`
          : `Write one sentence identifying the parent authority for drafting ${focus}. Do not draft the instrument yet.`,
      sampleStyleNote: hasSample ? `Sample detected. I will use it only as a structural specimen, not as authority to invent a new Act.` : undefined,
      provider: 'local-fallback',
    };
  }
  private buildBareActSampleProfile(sampleText: string): string[] {
    const text = sampleText.toLowerCase();
    const checks: Array<[string, RegExp]> = [
      ['Short title', /short\s+title/],
      ['Extent and application', /extent|application/],
      ['Commencement', /commencement|come\s+into\s+force/],
      ['Definitions clause', /definitions|in\s+this\s+act|unless\s+the\s+context\s+otherwise\s+requires/],
      ['Institution or authority', /authority|board|commission|officer|committee|university|registrar/],
      ['Powers and functions', /powers|functions|duties/],
      ['Procedural mechanism', /procedure|complaint|notice|inquiry|investigation|hearing/],
      ['Time limits', /within\s+\d+\s+days|period\s+of|time\s+limit/],
      ['Appeal or review', /appeal|review|revision/],
      ['Offences or contraventions', /offence|contravention|prohibited|no\s+person\s+shall/],
      ['Penalty or civil consequence', /penalty|punishable|fine|imprisonment|compensation/],
      ['Rule-making power', /power\s+to\s+make\s+rules|rules\s+made\s+under|may\s+make\s+rules/],
      ['Savings or transitional provisions', /savings|transitional|repeal|notwithstanding/],
      ['Schedules', /schedule|first\s+schedule|second\s+schedule/],
    ];

    const detected = checks.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
    return detected.length ? detected : [
      'Preliminary provisions',
      'Definitions clause',
      'Operative duties and powers',
      'Procedural mechanism',
      'Consequences and rule-making',
    ];
  }
  async howToWriteBareAct(userId: string, body: { provisionText: string; actName?: string; sectionRef?: string }) {
    const provisionText = String(body.provisionText || '').trim();
    const actName = String(body.actName || 'the Act').trim();
    const sectionRef = String(body.sectionRef || '').trim();
    const sampleStart = provisionText.indexOf('--- File:');
    const studentRequest = (sampleStart >= 0 ? provisionText.slice(0, sampleStart) : provisionText).trim();
    const uploadedSampleText = sampleStart >= 0 ? provisionText.slice(sampleStart, sampleStart + 12000).trim() : '';
    const topic = studentRequest
      .replace(/^(teach\s+me\s+how\s+to\s+draft|how\s+to\s+draft|draft|write|make)\s+(a\s+)?(bare\s+act|act|law|statute)?\s*(on|about|regarding|for)?\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[?.!]+$/, '') || studentRequest || 'the proposed subject';
    const corpusSampleText = uploadedSampleText.length > 200 ? '' : await this.loadBareActDraftingSample(topic);
    const sampleText = uploadedSampleText || corpusSampleText;
    const hasSample = sampleText.length > 200;
    const sampleProfile = hasSample ? this.buildBareActSampleProfile(sampleText) : [];
    const sampleProfileText = sampleProfile.length ? sampleProfile.join(', ') : '';
    const intent = this.classifyDraftingIntent(studentRequest, topic, actName, sectionRef);

    if (!intent.shouldCreateNewAct) {
      return this.buildExistingLawDraftingFallback(topic, intent, hasSample, sampleProfileText);
    }

    const actTitle = `THE ${topic.toUpperCase()} ACT`;

    const fallback = {
      topic,
      draftingIntent: intent.code,
      draftingIntentLabel: intent.label,
      existingLaw: undefined,
      shouldCreateNewAct: true,
      learningObjective: `A Parliamentary Counsel would not draft the first section yet; the first question is what mischief a Bare Act on ${topic} is meant to control and how that mischief should be arranged into chapters.`,
      overview: hasSample
        ? `The specimen Act teaches a discipline: it announces the Arrangement of Sections before the provisions, opens with preliminary machinery, defines terms before using them, and groups related legal effects into chapters. We will borrow that drafting judgment, not its words.`
        : `A Bare Act on ${topic} should not begin with random sections. A drafter first identifies the mischief, prepares the Arrangement of Sections, and checks whether each chapter has a legal function.`,
      draftingPlan: [
        `Ask the counsel question first: what mischief connected with ${topic} justifies legislation rather than policy alone?`,
        'Prepare the Arrangement of Sections before drafting clauses, so the Act has visible legal architecture.',
        'Open with PRELIMINARY provisions: short title, extent, commencement, application, and definitions, because later sections depend on these controls.',
        `Divide ${topic} into chapters that move from scope to duties, powers, procedure, safeguards, consequences, rule-making, savings, and schedules.`,
        'Draft one section at a time only after you can justify why that section appears in that chapter.',
      ],
      arrangementOfSections: [
        actTitle,
        'ARRANGEMENT OF SECTIONS',
        'PREAMBLE',
        'PRELIMINARY',
        '1. Short title, extent and commencement.',
        '2. Definitions.',
        `CHAPTER I - OF THE SCOPE AND APPLICATION OF ${topic.toUpperCase()}`,
        '3. Application of the Act.',
        '4. Persons and institutions to whom the Act applies.',
        'CHAPTER II - OF DUTIES, PROHIBITIONS AND SAFEGUARDS',
        '5. Duties of regulated institutions.',
        '6. Prohibited conduct.',
        '7. Safeguards for fair process.',
        'CHAPTER III - OF PROCEDURE AND CONSEQUENCES',
        '8. Complaint and inquiry procedure.',
        '9. Corrective directions and consequences.',
        '10. Power to make rules.',
      ],
      steps: [
        {
          stepNumber: 1,
          title: 'Identify the Legislative Purpose',
          instruction: `Before drafting any section, answer this in one sentence: what precise mischief connected with ${topic} requires statutory control, and who is the law meant to regulate?`,
          tip: 'Purpose is not decorative. It disciplines the whole Act: definitions decide the boundaries, duties identify who must act, powers identify who may act, procedures prevent arbitrary action, and penalties make sense only after the duty is clear.',
          example: `In a fictional University Digital Safety Act, the drafter would first ask whether the Act is about student discipline, institutional duty, online platform misuse, victim protection, or all four. That question determines the chapters; it is not a final provision.`,
        },
      ],
      draftingPrinciples: [
        'Arrangement of Sections is a drafting instrument, not a table of contents. It tests whether the Act has a logical legal sequence before any operative wording is attempted.',
        hasSample
          ? 'When using a specimen Act, copy the legislative reasoning: preliminary controls first, definitions before operative use, obligations before penalties, and procedural safeguards before adverse consequences.'
          : 'Before choosing words like shall or may, the drafter must know whether the clause creates a duty, discretion, prohibition, procedure, safeguard, or consequence.',
      ],
      commonMistakes: [
        'The beginner mistake is to write punishment first. A Parliamentary Counsel first asks who is regulated, what duty exists, who decides breach, what procedure is fair, and only then what consequence follows.',
      ],
      practiceTask: `Write one sentence naming the mischief and the regulated actor for a Bare Act on ${topic}. Do not draft definitions, offences, or penalties yet.`,
      sampleStyleNote: hasSample ? `Sample detected. I will use its drafting structure as reference: ${sampleProfileText}.` : undefined,
      provider: 'local-fallback',
    };

    try {
      const completion = await this.ai.complete({
        userId,
        module: 'research',
        temperature: 0.2,
        maxTokens: 1800,
        jsonMode: true,
        messages: [
          {
            role: 'system',
            content: 'You are a senior Parliamentary Counsel mentoring a law student. Teach drafting judgment, not answers. Use uploaded Bare Acts as specimens for reasoning: architecture, sequencing, definitions, duties, powers, procedures, safeguards, offences, penalties, rule-making, savings, repeals, schedules, cross-references, and legislative verbs. Never copy the specimen, never draft a complete Bare Act, never provide fill-in placeholders, and never complete the student assignment. Return strict JSON only.',
          },
          {
            role: 'user',
            content: `Student drafting topic:
"${topic}"

Student request:
"${studentRequest}"

${hasSample ? `Uploaded Bare Act specimen excerpt for structural study only:
${sampleText}

` : ''}Teach the student how to begin drafting a Bare Act on this topic. The answer must feel like a senior Parliamentary Counsel supervising a pupil drafter: calm, precise, Socratic, and concerned with why each drafting decision exists.

${hasSample ? `Detected specimen structure: ${sampleProfileText}. Use this structure to shape the roadmap, without copying the specimen text.` : ''}

Required response:
- Topic-specific, not generic.
- Show the Act architecture roadmap in 4-6 bullets and include a specimen-inspired Arrangement of Sections outline. This outline may contain section headings, but not full statutory provisions.
- Teach only the first micro-skill: legislative purpose and Act architecture before clauses.
- Explain why legislative purpose controls chapter order, definitions, duties, powers, procedures, offences, and penalties.
- Give one short fictional educational demonstration related to the topic.
- Ask one Socratic question and require one small student attempt.

Do not include placeholder templates.
Do not ask the student to draft an entire provision.
Do not reproduce the uploaded specimen.
Do not invent citations or legal claims.

Return strict JSON:
{
  "topic": "${topic}",
  "learningObjective": "One counsel-style sentence naming the drafting problem",
  "overview": "Two concise Parliamentary Counsel style sentences",
  "draftingPlan": ["4-6 short bullets showing the Bare Act architecture roadmap and why the order exists"],
  "arrangementOfSections": ["Specimen-inspired Arrangement of Sections headings for this topic, using PREAMBLE, PRELIMINARY, CHAPTER headings, and numbered section titles only"],
  "steps": [
    {
      "stepNumber": 1,
      "title": "Identify the Legislative Purpose",
      "instruction": "Instruction for this micro-skill only",
      "tip": "Why this drafting choice exists and how it affects later drafting",
      "example": "One short fictional demonstration related to the topic"
    }
  ],
  "draftingPrinciples": ["1-2 topic-aware principles about drafting judgment"],
  "commonMistakes": ["One key beginner mistake with legal consequence"],
  "practiceTask": "One small exercise asking the student to name the mischief and regulated actor",
  "sampleStyleNote": ${hasSample ? '"Uploaded specimen detected and used as a structural reasoning reference."' : 'null'}
}`,
          },
        ],
      });
      const parsed = tryParseJson(completion.content, fallback) as any;
      return {
        topic: cleanString(parsed.topic || fallback.topic),
        draftingIntent: intent.code,
        draftingIntentLabel: intent.label,
        existingLaw: undefined,
        shouldCreateNewAct: true,
        learningObjective: cleanString(parsed.learningObjective || fallback.learningObjective),
        overview: cleanString(parsed.overview || fallback.overview),
        draftingPlan: Array.isArray(parsed.draftingPlan) && parsed.draftingPlan.length
          ? parsed.draftingPlan.slice(0, 6).map(cleanString)
          : fallback.draftingPlan.map(cleanString),
        arrangementOfSections: Array.isArray(parsed.arrangementOfSections) && parsed.arrangementOfSections.length
          ? parsed.arrangementOfSections.slice(0, 24).map(cleanString)
          : fallback.arrangementOfSections.map(cleanString),
        steps: Array.isArray(parsed.steps) && parsed.steps.length
          ? [{
              stepNumber: Number(parsed.steps[0].stepNumber || 1),
              title: cleanString(parsed.steps[0].title || ''),
              instruction: cleanString(parsed.steps[0].instruction || ''),
              tip: cleanString(parsed.steps[0].tip || ''),
              example: cleanString(parsed.steps[0].example || ''),
            }]
          : fallback.steps.map(step => ({
              stepNumber: step.stepNumber,
              title: cleanString(step.title),
              instruction: cleanString(step.instruction),
              tip: cleanString(step.tip),
              example: cleanString(step.example),
            })),
        draftingPrinciples: Array.isArray(parsed.draftingPrinciples) && parsed.draftingPrinciples.length
          ? parsed.draftingPrinciples.slice(0, 2).map(cleanListItem)
          : fallback.draftingPrinciples.map(cleanListItem),
        commonMistakes: Array.isArray(parsed.commonMistakes) && parsed.commonMistakes.length
          ? parsed.commonMistakes.slice(0, 1).map(cleanListItem)
          : fallback.commonMistakes.map(cleanListItem),
        practiceTask: cleanString(parsed.practiceTask || fallback.practiceTask),
        sampleStyleNote: hasSample ? cleanString(parsed.sampleStyleNote || fallback.sampleStyleNote) : undefined,
        finalTemplate: undefined,
        provider: completion.provider,
      };
    } catch {
      return fallback;
    }
  }

  formatAutoTitle(query: string): string {
    const q = (query || '').trim();
    if (!q) return 'New Chat';
    const maxLen = 55;
    if (q.length <= maxLen) return q;
    const cutIndex = q.lastIndexOf(' ', maxLen);
    const finalCut = cutIndex >= 40 ? cutIndex : maxLen;
    return q.substring(0, finalCut).trim() + '...';
  }

  formatPreview(text: string): string {
    const q = (text || '').trim();
    if (!q) return 'No messages yet';
    const maxLen = 55;
    if (q.length <= maxLen) return q;
    const cutIndex = q.lastIndexOf(' ', maxLen);
    const finalCut = cutIndex >= 40 ? cutIndex : maxLen;
    return q.substring(0, finalCut).trim() + '...';
  }

  async getConversations(userId: string) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://mydrikssmzzudzqeqroe.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    const headers = {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json'
    };

    let convs = [];
    if (process.env.SUPABASE_DISABLED !== 'true') {
      try {
        const response = await axios.get(
          `${supabaseUrl}/rest/v1/bare_act_conversations?user_id=eq.${userId}&order=updated_at.desc`,
          { headers, timeout: 3000 }
        );
        convs = response.data || [];
        if (convs.length > 0) {
          const convIds = convs.map((c: any) => c.id);
          const msgsResponse = await axios.get(
            `${supabaseUrl}/rest/v1/bare_act_messages?conversation_id=in.(${convIds.map((id: string) => `"${id}"`).join(',')})&order=created_at.asc`,
            { headers, timeout: 3000 }
          );
          const msgs = msgsResponse.data || [];
          
          const firstUserMsgMap: Record<string, string> = {};
          const latestMsgMap: Record<string, string> = {};
          for (const m of msgs) {
            if (m.role === 'user') {
              if (!firstUserMsgMap[m.conversation_id]) {
                firstUserMsgMap[m.conversation_id] = m.content;
              }
              latestMsgMap[m.conversation_id] = m.content;
            }
          }

          for (const c of convs) {
            const firstUserMsg = firstUserMsgMap[c.id];
            if (firstUserMsg) {
              c.title = this.formatAutoTitle(firstUserMsg);
            }
            const latestMsg = latestMsgMap[c.id] || c.last_message || '';
            c.last_message = this.formatPreview(latestMsg);
          }
        }
        return convs;
      } catch (err: any) {
        this.logger.warn(`Supabase getConversations failed, falling back to mock storage: ${err.message}`);
      }
    }
    
    // Fallback
    convs = this.mockConversations.filter(c => c.user_id === userId)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    
    const firstUserMsgMap: Record<string, string> = {};
    const latestMsgMap: Record<string, string> = {};
    for (const m of this.mockMessages) {
      if (m.role === 'user') {
        if (!firstUserMsgMap[m.conversation_id]) {
          firstUserMsgMap[m.conversation_id] = m.content;
        }
        latestMsgMap[m.conversation_id] = m.content;
      }
    }

    for (const c of convs) {
      const firstUserMsg = firstUserMsgMap[c.id];
      if (firstUserMsg) {
        c.title = this.formatAutoTitle(firstUserMsg);
      }
      const latestMsg = latestMsgMap[c.id] || c.last_message || '';
      c.last_message = this.formatPreview(latestMsg);
    }
    return convs;
  }

  async saveConversation(userId: string, body: any) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://mydrikssmzzudzqeqroe.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    const headers = {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=representation'
    };

    const conv = {
      id: body.id,
      user_id: userId,
      title: body.title,
      mode: body.mode || 'explain',
      last_message: body.last_message,
      created_at: body.created_at || new Date().toISOString(),
      updated_at: body.updated_at || new Date().toISOString()
    };

    if (process.env.SUPABASE_DISABLED !== 'true') {
      try {
        const response = await axios.post(
          `${supabaseUrl}/rest/v1/bare_act_conversations`,
          conv,
          { headers, timeout: 3000 }
        );
        return response.data[0] || conv;
      } catch (err: any) {
        this.logger.warn(`Supabase saveConversation failed, using mock storage: ${err.message}`);
      }
    }
    const existingIdx = this.mockConversations.findIndex(c => c.id === conv.id);
    if (existingIdx >= 0) {
      this.mockConversations[existingIdx] = { ...this.mockConversations[existingIdx], ...conv };
    } else {
      this.mockConversations.push(conv);
    }
    return conv;
  }

  async saveMessage(userId: string, body: any) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://mydrikssmzzudzqeqroe.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    const headers = {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=representation'
    };

    const msg = {
      id: body.id,
      conversation_id: body.conversation_id,
      role: body.role,
      content: body.content,
      metadata: body.metadata || {},
      created_at: body.created_at || new Date().toISOString()
    };

    if (process.env.SUPABASE_DISABLED !== 'true') {
      try {
        const response = await axios.post(
          `${supabaseUrl}/rest/v1/bare_act_messages`,
          msg,
          { headers, timeout: 3000 }
        );
        return response.data[0] || msg;
      } catch (err: any) {
        this.logger.warn(`Supabase saveMessage failed, using mock storage: ${err.message}`);
      }
    }
    const existingIdx = this.mockMessages.findIndex(m => m.id === msg.id);
    if (existingIdx >= 0) {
      this.mockMessages[existingIdx] = msg;
    } else {
      this.mockMessages.push(msg);
    }
    return msg;
  }

  async deleteConversation(userId: string, id: string) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://mydrikssmzzudzqeqroe.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    const headers = {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    };

    if (process.env.SUPABASE_DISABLED !== 'true') {
      try {
        await axios.delete(
          `${supabaseUrl}/rest/v1/bare_act_conversations?id=eq.${id}`,
          { headers, timeout: 3000 }
        );
        return { success: true };
      } catch (err: any) {
        this.logger.warn(`Supabase deleteConversation failed, using mock storage: ${err.message}`);
      }
    }
    this.mockConversations = this.mockConversations.filter(c => c.id !== id);
    this.mockMessages = this.mockMessages.filter(m => m.conversation_id !== id);
    return { success: true };
  }

  async getMessages(userId: string, id: string) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://mydrikssmzzudzqeqroe.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    const headers = {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    };

    if (process.env.SUPABASE_DISABLED !== 'true') {
      try {
        const response = await axios.get(
          `${supabaseUrl}/rest/v1/bare_act_messages?conversation_id=eq.${id}&order=created_at.asc`,
          { headers, timeout: 3000 }
        );
        return response.data;
      } catch (err: any) {
        this.logger.warn(`Supabase getMessages failed, using mock storage: ${err.message}`);
      }
    }
    return this.mockMessages.filter(m => m.conversation_id === id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  async renameConversation(userId: string, id: string, title: string) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://mydrikssmzzudzqeqroe.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    const headers = {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json'
    };

    if (process.env.SUPABASE_DISABLED !== 'true') {
      try {
        await axios.patch(
          `${supabaseUrl}/rest/v1/bare_act_conversations?id=eq.${id}`,
          { title, updated_at: new Date().toISOString() },
          { headers, timeout: 3000 }
        );
        return { success: true };
      } catch (err: any) {
        this.logger.warn(`Supabase renameConversation failed, using mock storage: ${err.message}`);
      }
    }
    const existing = this.mockConversations.find(c => c.id === id);
    if (existing) {
      existing.title = title;
      existing.updated_at = new Date().toISOString();
    }
    return { success: true };
  }

  private mockConversations: any[] = [];
  private mockMessages: any[] = [];
}


















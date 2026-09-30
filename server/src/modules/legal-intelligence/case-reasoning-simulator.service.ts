import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpenRouterAiProviderService } from '../chat/openrouter-ai-provider.service';
import { SemanticCacheService } from '../chat/semantic-cache.service';
import { CaseSimulationSession } from './legal-intelligence.entities';

type CaseReasoningScores = {
  overallLegalReasoning: number;
  factIdentification: number;
  issueSpotting: number;
  lawApplication: number;
  caseLawUsage: number;
  professionalWriting: number;
  argumentQuality: number;
  criticalThinking: number;
  argumentStrength: number;
  finalScore: number;
  grade: string;
};

type SectionReport = {
  summary: string;
  strengths: string[];
  gaps: string[];
  suggestions: string[];
};

type CaseOverview = {
  caseName: string;
  natureOfDispute: string;
  areaOfLaw: string;
  keyLegalIssue: string;
  difficultyLevel: string;
};

type BestCaseReport = {
  title: string;
  introduction: string;
  facts: string[];
  issues: string[];
  applicableLaw: string[];
  caseLaw: string[];
  analysis: string;
  counterArguments: string[];
  conclusion: string;
  legalPrinciple: string;
  examReadyAnswer: string;
};

type CaseReasoningReport = {
  attemptId?: string;
  caseNameOrProblem: string;
  status: 'evaluated' | 'saved';
  createdAt: string;
  sections: {
    caseOverview: CaseOverview;
    understandingOfFacts: SectionReport;
    issueIdentification: SectionReport;
    applicableLaw: SectionReport;
    caseLawAnalysis: SectionReport;
    legalReasoning: SectionReport;
    simplifiedExplanation: {
      facts: string;
      issues: string;
      law: string;
      application: string;
      reasoning: string;
      courtReasoning: string;
      decision: string;
      ratiodecidendi: string;
      legalPrinciple: string;
      practicalApplication: string;
      examTips: string;
      realLifeExample: string;
    };
    mistakes: string[];
    professionalSolution: string;
    bestCaseReport: BestCaseReport;
    modelLegalAnswer: {
      issue: string;
      materialFacts: string;
      legalFramework: string;
      precedentApplication: string;
      petitionerCase: string;
      respondentCase: string;
      rebuttal: string;
      likelyJudicialApproach: string;
      conclusion: string;
      remedyRelief?: string;
      examTakeaway: string;
    };
    learningRecommendations: {
      whatStudentDidWell: string[];
      whatToImprove: string[];
      relatedBareActs: string[];
      relatedSections: string[];
      relatedCases: string[];
      relatedMockTests: string[];
      relatedFlashcards: string[];
      relatedResearchTopics: string[];
    };
    performanceScore: CaseReasoningScores;
  };
  professorComments: string;
  provider: string;
};

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function gradeFromScore(score: number): string {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function normalizeStringArray(value: unknown, fallback: string[], max = 12) {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value.map((item) => String(item || '').trim()).filter(Boolean);
  return cleaned.length ? cleaned.slice(0, max) : fallback;
}

function parseJsonObject<T>(value: string, fallback: T): T {
  try {
    const cleaned = value
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return fallback;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

@Injectable()
export class CaseReasoningSimulatorService {
  constructor(
    @InjectRepository(CaseSimulationSession)
    private readonly attemptsRepo: Repository<CaseSimulationSession>,
    private readonly ai: OpenRouterAiProviderService,
    private readonly cache: SemanticCacheService,
  ) {}

  async analyze(userId: string, body: { caseNameOrProblem?: string; studentReasoning?: string; studentSolution?: string }) {
    const caseNameOrProblem = String(body.caseNameOrProblem || '').trim();
    const studentReasoning = String(body.studentReasoning || body.studentSolution || '').trim();

    if (!caseNameOrProblem && !studentReasoning) {
      throw new BadRequestException('Enter a case name or legal problem, then write your legal reasoning.');
    }
    if (!caseNameOrProblem) {
      throw new BadRequestException('Please enter a case name or paste the legal problem before analysis.');
    }
    if (!studentReasoning) {
      throw new BadRequestException('Please write your legal reasoning before analysis.');
    }
    if (studentReasoning.length < 40) {
      throw new BadRequestException('Please add a fuller reasoning attempt covering facts, issues, law, application, and conclusion.');
    }

    const cacheKey = `case-reasoning-v2:${caseNameOrProblem.slice(0, 120)}:${studentReasoning.slice(0, 600)}`;
    const cached = await this.cache.get('research', cacheKey, userId);
    let report: CaseReasoningReport = cached ? this.normalizeReport(cached, caseNameOrProblem) : this.localReport(caseNameOrProblem, studentReasoning);

    if (!cached) {
      try {
        const completion = await this.ai.complete({
          userId,
          module: 'research',
          temperature: 0.18,
          maxTokens: 14000,
          timeoutMs: 55000,
          jsonMode: true,
          messages: [
            {
              role: 'system',
              content:
                'You are LEGATRIXON Case Reasoning Simulator — an elite senior law professor and senior advocate. Your sole role is to evaluate a student\'s legal reasoning and teach them how to think like a lawyer. Never summarize judgments generically. Always evaluate the student\'s specific submission. Detect irrelevant, random, or non-legal text and flag it clearly. Return valid, complete JSON only. Do not truncate.',
            },
            {
              role: 'user',
              content: this.buildPrompt(caseNameOrProblem, studentReasoning),
            },
          ],
        });

        report = this.normalizeReport(parseJsonObject(completion.content, report), caseNameOrProblem);
        report.provider = completion.provider;
      } catch {
        report.provider = 'local-fallback';
      }

      await this.cache.set('research', cacheKey, report, { feature: 'case-reasoning-simulator' });
    }

    const saved = await this.attemptsRepo.save(
      this.attemptsRepo.create({
        userId,
        caseName: caseNameOrProblem.slice(0, 300),
        customScenario: caseNameOrProblem.length > 300 ? caseNameOrProblem : null,
        practiceMode: 'Case Reasoning Simulator',
        studentAnswers: { reasoning: studentReasoning },
        evaluationResult: report,
        status: 'evaluated',
      }),
    );

    report.attemptId = saved.id;
    report.createdAt = saved.createdAt.toISOString();
    report.status = 'evaluated';
    saved.evaluationResult = report;
    await this.attemptsRepo.save(saved);
    return report;
  }

  async listHistory(userId: string) {
    const attempts = await this.attemptsRepo.find({
      where: { userId, practiceMode: 'Case Reasoning Simulator' },
      order: { createdAt: 'DESC' },
      take: 25,
    });

    return attempts.map((attempt) => ({
      id: attempt.id,
      caseName: attempt.caseName || 'Custom legal problem',
      date: attempt.createdAt,
      score: attempt.evaluationResult?.sections?.performanceScore?.finalScore ?? attempt.evaluationResult?.scores?.overallScore ?? 0,
      status: attempt.status || 'evaluated',
    }));
  }

  async getAttempt(userId: string, id: string) {
    const attempt = await this.attemptsRepo.findOne({ where: { id, userId, practiceMode: 'Case Reasoning Simulator' } });
    if (!attempt) throw new NotFoundException('Analysis attempt not found.');

    const report = this.normalizeReport(attempt.evaluationResult, attempt.caseName || 'Custom legal problem');
    report.attemptId = attempt.id;
    report.createdAt = attempt.createdAt.toISOString();
    report.status = attempt.status === 'saved' ? 'saved' : 'evaluated';

    return {
      report,
      caseNameOrProblem: attempt.customScenario || attempt.caseName,
      studentReasoning: attempt.studentAnswers?.reasoning || '',
    };
  }

  async saveAttempt(userId: string, id: string) {
    const attempt = await this.attemptsRepo.findOne({ where: { id, userId, practiceMode: 'Case Reasoning Simulator' } });
    if (!attempt) throw new NotFoundException('Analysis attempt not found.');

    attempt.status = 'saved';
    if (attempt.evaluationResult) {
      attempt.evaluationResult.status = 'saved';
    }
    await this.attemptsRepo.save(attempt);
    return { success: true, status: 'saved' };
  }

  private buildPrompt(caseNameOrProblem: string, studentReasoning: string) {
    const isIrrelevant = studentReasoning.length < 80 || !/\b(law|act|section|article|court|judgment|case|rights|liability|contract|tort|constitution|legal|facts|issue|provision|duty|remedy|held|plaintiff|defendant|appellant|respondent|bare act|negligence|evidence|procedure)\b/i.test(studentReasoning);

    return `You are a senior law professor reviewing a student's legal reasoning submission. Your task is to deeply evaluate the student's attempt and generate a comprehensive professor's report covering all 12 sections below.

SENIOR ADVOCATE MODE RULES FOR "modelLegalAnswer":
- The "modelLegalAnswer" must NOT be a generic summary of the selected landmark case. The selected landmark case is the legal foundation, but the hypothetical scenario is the problem to be solved. You must solve the hypothetical scenario.
- Write as an experienced, rigorous, strategic, and adversarial senior advocate preparing a serious court submission. Acknowledge uncertainty where the law or facts leave room for competing outcomes.
- Under each legal heading in "modelLegalAnswer", write substantive paragraphs rather than bulleted lists or short outlines. Do NOT over-structure with nested sub-bullets.
- Target a length of 800-1500 words for the "modelLegalAnswer" (up to 1200-2000 words for advanced or complex problems) to ensure deep, rigorous legal value in every paragraph.
- Ground the solution strictly in the exact hypothetical question, scenario, and verified legal sources.
- Do NOT use the student's submission to construct the model answer. The model answer must be independently reasoned.

IMPORTANT RULES:
- If the student's reasoning appears to be random, irrelevant, or non-legal text (short gibberish, lorem ipsum, unrelated content), set all scores to 0-15, flag in mistakes[], and write professorComments explaining that meaningful legal reasoning is required.
- Evaluate ONLY the specific reasoning written by the student. Do not generate generic case summaries.
- Be a strict but fair professor. Identify EVERY mistake. Explain WHY it is wrong.
- Write the bestCaseReport and professionalSolution independently as ideal model answers — not derived from the student's flawed reasoning.
- All scores must be integers 0-100. finalScore = weighted average of all criteria.
- grade must be one of: A (85-100), B (70-84), C (55-69), D (40-54), F (0-39)
${isIrrelevant ? '- The student submission appears very short or lacks legal vocabulary. Evaluate accordingly with low scores.' : ''}

Case name or legal problem:
${caseNameOrProblem}

Student's legal reasoning:
${studentReasoning.slice(0, 28000)}

Return ONE complete JSON object with EXACTLY this structure (no truncation, no markdown):
{
  "caseNameOrProblem": "${caseNameOrProblem}",
  "sections": {
    "caseOverview": {
      "caseName": "",
      "natureOfDispute": "",
      "areaOfLaw": "",
      "keyLegalIssue": "",
      "difficultyLevel": ""
    },
    "understandingOfFacts": {
      "summary": "Evaluate whether the student correctly identified the operative facts. Point out what they got right and wrong.",
      "strengths": ["fact they correctly identified"],
      "gaps": ["important fact they missed or got wrong"],
      "suggestions": ["how to improve fact identification"]
    },
    "issueIdentification": {
      "summary": "Did the student correctly frame the legal, constitutional, statutory, procedural and jurisdictional issues?",
      "strengths": [],
      "gaps": ["missing issues — list every one"],
      "suggestions": []
    },
    "applicableLaw": {
      "summary": "Which Bare Acts, Sections, Articles, Rules were correctly cited vs missed vs wrong?",
      "strengths": ["correctly cited provisions"],
      "gaps": ["missing or wrong provisions"],
      "suggestions": ["additional provisions that must be cited"]
    },
    "caseLawAnalysis": {
      "summary": "Evaluate use of judgments, precedents, authorities. Explain why each precedent matters.",
      "strengths": ["correctly cited cases and why they help"],
      "gaps": ["missing landmark cases and why they are important"],
      "suggestions": ["how to use precedents better"]
    },
    "legalReasoning": {
      "summary": "This is the most critical section. Evaluate logical thinking, application of law, arguments, counter-arguments, analytical skills. Explain how an experienced lawyer would think differently.",
      "strengths": ["what the student reasoned correctly"],
      "gaps": ["every weakness in legal reasoning — be specific"],
      "suggestions": ["how to improve legal reasoning step by step"]
    },
    "simplifiedExplanation": {
      "facts": "Explain the material facts of the case in very simple language",
      "issues": "What is the key legal question being decided?",
      "law": "What law governs this case and why?",
      "application": "How does the law apply to these facts?",
      "reasoning": "How should a lawyer think through this problem step by step?",
      "courtReasoning": "How did the court actually reason through this case? What logic did it apply?",
      "decision": "What was the final decision and who won?",
      "ratiodecidendi": "What is the ratio decidendi — the binding legal rule from this case?",
      "legalPrinciple": "State the core legal principle in one clear sentence",
      "practicalApplication": "How is this principle applied in real legal practice today?",
      "examTips": "Specific exam strategy tips: which sections to cite, how to structure the answer, what examiners look for, common mistakes to avoid"
    },
    "mistakes": [
      "Wrong interpretation of [specific rule] because [reason]",
      "Failed to cite [specific provision] which is mandatory in this analysis",
      "Argument on [point] is unsupported because [reason]",
      "Missing the [specific legal test] which courts always apply",
      "Incomplete analysis of [element] — explain what was missing"
    ],
    "modelLegalAnswer": {
      "issue": "Construct a precise legal issue arising from the hypothetical. Do not write a generic question. Make it specific to the hypothetical facts.",
      "materialFacts": "Identify the facts that affect the analysis. Explain why they matter. If any key facts are missing, explicitly state the legal assumptions made.",
      "legalFramework": "Identify the controlling legal framework. Explain the rule and why it matters here. Detail the legal relationship between statutory provisions and precedents.",
      "precedentApplication": "Apply the precedent of the selected landmark case to the hypothetical. Explain what principle controls, does the hypothetical satisfy the condition, similarities, differences, and if it controls or merely guides.",
      "petitionerCase": "Develop the strongest legal argument for the petitioner/claimant. It should read like advocacy, connecting facts, text, purpose, and precedent.",
      "respondentCase": "Develop the strongest legal argument for the respondent/State. Present a rigorous defense rather than a weak straw-man argument.",
      "rebuttal": "Rebuttal and counter-argument evaluation. Identify the strongest point against the petitioner and how they answer it, and the strongest point against the respondent and why one is stronger.",
      "likelyJudicialApproach": "Step-by-step reasoning showing how a court would evaluate the dispute. Sequence: Identify power → Identify limitation → Apply precedent → Balance arguments → Determine relief.",
      "conclusion": "Write a specific, qualified, fact-based conclusion that emerges directly from the reasoning.",
      "remedyRelief": "State the specific remedy or relief the lawyer would request (e.g. strike down, read down, declare unconstitutional, dismiss challenge).",
      "examTakeaway": "Write a concise exam tip summarizing what key takeaway the student must remember."
    },
    "professionalSolution": "Write a complete, professional model answer exactly as an experienced senior advocate or law professor would write it. Include: facts → issues → applicable law with sections → legal analysis with IRAC → case law with reasons → counter-arguments → conclusion → legal principle. This must be a complete standalone answer, not a template.",
    "bestCaseReport": {
      "title": "",
      "introduction": "",
      "facts": ["material fact 1", "material fact 2"],
      "issues": ["Issue 1: Whether...", "Issue 2: Whether..."],
      "applicableLaw": ["Section X of Act Y — explains Z", "Article A — because B"],
      "caseLaw": ["Case Name (Year) — ratio — why it applies here"],
      "analysis": "Full IRAC analysis written as an ideal exam answer",
      "counterArguments": ["Counter-argument 1 and why it fails", "Counter-argument 2"],
      "conclusion": "",
      "legalPrinciple": "",
      "examReadyAnswer": "A complete exam-ready answer written in formal legal prose covering all required elements for a high-scoring answer"
    },
    "learningRecommendations": {
      "whatStudentDidWell": ["specific thing done correctly"],
      "whatToImprove": ["specific improvement needed"],
      "relatedBareActs": ["Act name — why to read it"],
      "relatedSections": ["Section X of Act Y — what it says"],
      "relatedCases": ["Case Name — what to learn from it"],
      "relatedMockTests": ["practice exercise type"],
      "relatedFlashcards": ["concept to memorize"],
      "relatedResearchTopics": ["topic for deeper study"]
    },
    "performanceScore": {
      "overallLegalReasoning": 0,
      "factIdentification": 0,
      "issueSpotting": 0,
      "lawApplication": 0,
      "caseLawUsage": 0,
      "professionalWriting": 0,
      "argumentQuality": 0,
      "criticalThinking": 0,
      "argumentStrength": 0,
      "finalScore": 0,
      "grade": "F"
    }
  },
  "professorComments": "Write 3-5 sentences of direct professor feedback addressed to the student. Be honest, constructive, and specific. Tell them exactly what they must do to improve."
}`;
  }

  private normalizeReport(value: unknown, caseNameOrProblem: string): CaseReasoningReport {
    const fallback = this.localReport(caseNameOrProblem, '');
    const source = asRecord(value);
    const sections = asRecord(source.sections);
    const scores = asRecord(sections.performanceScore || source.scores);
    const caseOverview = asRecord(sections.caseOverview);
    const simplifiedExplanation = asRecord(sections.simplifiedExplanation);
    const bestCaseReport = asRecord(sections.bestCaseReport);
    const modelLegalAnswer = asRecord(sections.modelLegalAnswer);
    const learningRecommendations = asRecord(sections.learningRecommendations);

    const normalizeSection = (sectionValue: unknown, backup: SectionReport): SectionReport => {
      const section = asRecord(sectionValue);
      return {
        summary: String(section.summary || sectionValue || backup.summary || '').trim(),
        strengths: normalizeStringArray(section.strengths, backup.strengths),
        gaps: normalizeStringArray(section.gaps, backup.gaps),
        suggestions: normalizeStringArray(section.suggestions, backup.suggestions),
      };
    };

    const finalScore = clampScore(Number(scores.finalScore ?? scores.overallScore));

    return {
      attemptId: typeof source.attemptId === 'string' ? source.attemptId : undefined,
      caseNameOrProblem: String(source.caseNameOrProblem || caseNameOrProblem),
      status: source.status === 'saved' ? 'saved' : 'evaluated',
      createdAt: String(source.createdAt || new Date().toISOString()),
      sections: {
        caseOverview: {
          caseName: String(caseOverview.caseName || caseNameOrProblem),
          natureOfDispute: String(caseOverview.natureOfDispute || fallback.sections.caseOverview.natureOfDispute),
          areaOfLaw: String(caseOverview.areaOfLaw || fallback.sections.caseOverview.areaOfLaw),
          keyLegalIssue: String(caseOverview.keyLegalIssue || fallback.sections.caseOverview.keyLegalIssue),
          difficultyLevel: String(caseOverview.difficultyLevel || fallback.sections.caseOverview.difficultyLevel),
        },
        understandingOfFacts: normalizeSection(sections.understandingOfFacts || source.understandingOfFacts, fallback.sections.understandingOfFacts),
        issueIdentification: normalizeSection(sections.issueIdentification || source.issueIdentification, fallback.sections.issueIdentification),
        applicableLaw: normalizeSection(sections.applicableLaw || source.bareActAnalysis, fallback.sections.applicableLaw),
        caseLawAnalysis: normalizeSection(sections.caseLawAnalysis || source.caseLawAnalysis, fallback.sections.caseLawAnalysis),
        legalReasoning: normalizeSection(sections.legalReasoning || source.legalReasoningAnalysis, fallback.sections.legalReasoning),
        simplifiedExplanation: {
          facts: String(simplifiedExplanation.facts || fallback.sections.simplifiedExplanation.facts),
          issues: String(simplifiedExplanation.issues || fallback.sections.simplifiedExplanation.issues),
          law: String(simplifiedExplanation.law || fallback.sections.simplifiedExplanation.law),
          application: String(simplifiedExplanation.application || fallback.sections.simplifiedExplanation.application),
          reasoning: String(simplifiedExplanation.reasoning || fallback.sections.simplifiedExplanation.reasoning),
          courtReasoning: String(simplifiedExplanation.courtReasoning || fallback.sections.simplifiedExplanation.courtReasoning),
          decision: String(simplifiedExplanation.decision || fallback.sections.simplifiedExplanation.decision),
          ratiodecidendi: String(simplifiedExplanation.ratiodecidendi || fallback.sections.simplifiedExplanation.ratiodecidendi),
          legalPrinciple: String(simplifiedExplanation.legalPrinciple || fallback.sections.simplifiedExplanation.legalPrinciple),
          practicalApplication: String(simplifiedExplanation.practicalApplication || fallback.sections.simplifiedExplanation.practicalApplication),
          examTips: String(simplifiedExplanation.examTips || fallback.sections.simplifiedExplanation.examTips),
          realLifeExample: String(simplifiedExplanation.realLifeExample || fallback.sections.simplifiedExplanation.realLifeExample),
        },
        mistakes: normalizeStringArray(sections.mistakes || source.mistakesMade, fallback.sections.mistakes, 20),
        professionalSolution: String(sections.professionalSolution || source.modelAnswer || source.betterWayToSolve || fallback.sections.professionalSolution),
        bestCaseReport: {
          title: String(bestCaseReport.title || fallback.sections.bestCaseReport.title),
          introduction: String(bestCaseReport.introduction || fallback.sections.bestCaseReport.introduction),
          facts: normalizeStringArray(bestCaseReport.facts, fallback.sections.bestCaseReport.facts),
          issues: normalizeStringArray(bestCaseReport.issues, fallback.sections.bestCaseReport.issues),
          applicableLaw: normalizeStringArray(bestCaseReport.applicableLaw, fallback.sections.bestCaseReport.applicableLaw),
          caseLaw: normalizeStringArray(bestCaseReport.caseLaw, fallback.sections.bestCaseReport.caseLaw),
          analysis: String(bestCaseReport.analysis || fallback.sections.bestCaseReport.analysis),
          counterArguments: normalizeStringArray(bestCaseReport.counterArguments, fallback.sections.bestCaseReport.counterArguments),
          conclusion: String(bestCaseReport.conclusion || fallback.sections.bestCaseReport.conclusion),
          legalPrinciple: String(bestCaseReport.legalPrinciple || fallback.sections.bestCaseReport.legalPrinciple),
          examReadyAnswer: String(bestCaseReport.examReadyAnswer || fallback.sections.bestCaseReport.examReadyAnswer),
        },
        modelLegalAnswer: {
          issue: String(modelLegalAnswer.issue || fallback.sections.modelLegalAnswer.issue).trim(),
          materialFacts: String(modelLegalAnswer.materialFacts || fallback.sections.modelLegalAnswer.materialFacts).trim(),
          legalFramework: String(modelLegalAnswer.legalFramework || fallback.sections.modelLegalAnswer.legalFramework).trim(),
          precedentApplication: String(modelLegalAnswer.precedentApplication || fallback.sections.modelLegalAnswer.precedentApplication).trim(),
          petitionerCase: String(modelLegalAnswer.petitionerCase || fallback.sections.modelLegalAnswer.petitionerCase).trim(),
          respondentCase: String(modelLegalAnswer.respondentCase || fallback.sections.modelLegalAnswer.respondentCase).trim(),
          rebuttal: String(modelLegalAnswer.rebuttal || fallback.sections.modelLegalAnswer.rebuttal).trim(),
          likelyJudicialApproach: String(modelLegalAnswer.likelyJudicialApproach || fallback.sections.modelLegalAnswer.likelyJudicialApproach).trim(),
          conclusion: String(modelLegalAnswer.conclusion || fallback.sections.modelLegalAnswer.conclusion).trim(),
          remedyRelief: modelLegalAnswer.remedyRelief ? String(modelLegalAnswer.remedyRelief).trim() : undefined,
          examTakeaway: String(modelLegalAnswer.examTakeaway || fallback.sections.modelLegalAnswer.examTakeaway).trim(),
        },
        learningRecommendations: {
          whatStudentDidWell: normalizeStringArray(learningRecommendations.whatStudentDidWell, fallback.sections.learningRecommendations.whatStudentDidWell),
          whatToImprove: normalizeStringArray(learningRecommendations.whatToImprove, fallback.sections.learningRecommendations.whatToImprove),
          relatedBareActs: normalizeStringArray(learningRecommendations.relatedBareActs, fallback.sections.learningRecommendations.relatedBareActs),
          relatedSections: normalizeStringArray(learningRecommendations.relatedSections, fallback.sections.learningRecommendations.relatedSections),
          relatedCases: normalizeStringArray(learningRecommendations.relatedCases, fallback.sections.learningRecommendations.relatedCases),
          relatedMockTests: normalizeStringArray(learningRecommendations.relatedMockTests, fallback.sections.learningRecommendations.relatedMockTests),
          relatedFlashcards: normalizeStringArray(learningRecommendations.relatedFlashcards, fallback.sections.learningRecommendations.relatedFlashcards),
          relatedResearchTopics: normalizeStringArray(learningRecommendations.relatedResearchTopics, fallback.sections.learningRecommendations.relatedResearchTopics),
        },
        performanceScore: {
          overallLegalReasoning: clampScore(Number(scores.overallLegalReasoning ?? scores.overallScore)),
          factIdentification: clampScore(Number(scores.factIdentification ?? scores.factRecall)),
          issueSpotting: clampScore(Number(scores.issueSpotting)),
          lawApplication: clampScore(Number(scores.lawApplication ?? scores.statutoryApplication)),
          caseLawUsage: clampScore(Number(scores.caseLawUsage ?? scores.precedentUsage)),
          professionalWriting: clampScore(Number(scores.professionalWriting ?? scores.analyticalLogic)),
          argumentQuality: clampScore(Number(scores.argumentQuality ?? scores.analyticalLogic)),
          criticalThinking: clampScore(Number(scores.criticalThinking ?? scores.argumentQuality ?? scores.analyticalLogic)),
          argumentStrength: clampScore(Number(scores.argumentStrength ?? scores.argumentQuality)),
          finalScore,
          grade: String(scores.grade || gradeFromScore(finalScore)),
        },
      },
      professorComments: String(source.professorComments || fallback.professorComments),
      provider: String(source.provider || fallback.provider || 'local-fallback'),
    };
  }

  private section(summary: string, strengths: string[], gaps: string[], suggestions: string[]): SectionReport {
    return { summary, strengths, gaps, suggestions };
  }

  private localReport(caseNameOrProblem: string, studentReasoning: string): CaseReasoningReport {
    const topic = caseNameOrProblem || 'the legal problem';
    const text = `${caseNameOrProblem} ${studentReasoning}`.toLowerCase();
    const isWrong =
      /\b(parliament has unlimited power|no basic structure|no duty of care|mere advertisement only|manufacturer not liable|fundamental rights cannot ever be amended)\b/i.test(studentReasoning);
    const isIrrelevant = studentReasoning.length < 60 || !/\b(law|act|section|article|court|judgment|case|rights|liability|contract|tort|constitution|legal|facts|issue|provision|duty|remedy|held|plaintiff|defendant|appellant|respondent)\b/i.test(studentReasoning);
    const detailScore = isIrrelevant ? 10 : Math.min(92, Math.max(42, 44 + Math.floor(studentReasoning.length / 220) * 8));
    const correctnessSignals = [
      text.includes('donoghue') && text.includes('duty of care') && (text.includes('neighbour') || text.includes('privity') || text.includes('opaque')),
      text.includes('kesavananda') && text.includes('basic structure') && text.includes('article 368') && (text.includes('judicial review') || text.includes('cannot destroy')),
      text.includes('carlill') && text.includes('unilateral') && (text.includes('performance') || text.includes('acceptance')) && (text.includes('consideration') || text.includes('deposit')),
    ].filter(Boolean).length;
    const boostedScore = correctnessSignals ? Math.max(detailScore, 84 + correctnessSignals * 3) : detailScore;
    const finalScore = isIrrelevant ? 10 : isWrong ? Math.min(45, detailScore) : Math.min(94, boostedScore);

    let profile = {
      caseName: topic,
      natureOfDispute: 'Legal dispute requiring analysis of applicable law and precedent',
      areaOfLaw: 'General Legal Principles',
      keyLegalIssue: 'Whether the applicable law and facts support the claimed legal position',
      difficultyLevel: 'Intermediate',
      facts: `The problem requires separating material facts from background narration and identifying the legal relationship between the parties in ${topic}.`,
      issues: 'The issues should be framed as precise legal questions, not broad topic headings.',
      law: 'The answer should identify the controlling statute, constitutional article, common law rule, or binding precedent before applying it.',
      application: 'The student must connect each legal element to a specific fact and test possible counter-arguments.',
      courtReasoning: 'The court applied the governing rule to the material facts and examined whether each element of the legal test was satisfied.',
      decision: 'The conclusion should flow from the rule application rather than from instinct or moral preference.',
      ratiodecidendi: 'The binding legal rule established by the court that applies to future similar cases.',
      principle: 'Legal reasoning is strongest when facts, issues, rules, application, and conclusion are visibly linked.',
      practicalApplication: 'This principle continues to govern similar disputes in practice. Lawyers cite it when advising clients on rights, liabilities, and remedies.',
      examTips: 'Use IRAC structure. Always frame issues as "Whether...". Cite specific sections and article numbers. Address counter-arguments before concluding. Show the chain from fact → rule → application → conclusion.',
      authorities: ['Relevant statute or constitutional provision', 'Binding Supreme Court or landmark common law precedent'],
      sections: ['IRAC structure', 'Material facts', 'Issues', 'Applicable law', 'Conclusion'],
    };

    if (text.includes('donoghue') || text.includes('stevenson')) {
      profile = {
        caseName: 'Donoghue v Stevenson [1932] AC 562',
        natureOfDispute: 'Tort — negligence — manufacturer liability to ultimate consumer',
        areaOfLaw: 'Law of Torts — Negligence',
        keyLegalIssue: 'Whether a manufacturer owes a duty of care to the ultimate consumer absent contractual privity',
        difficultyLevel: 'Intermediate — Landmark Common Law',
        facts: 'Mrs Donoghue consumed ginger beer from an opaque bottle allegedly containing a decomposed snail, with no contract directly between her and the manufacturer Stevenson.',
        issues: 'Whether a manufacturer owes a duty of care to an ultimate consumer despite absence of contractual privity.',
        law: 'The controlling doctrine is negligence in tort, especially duty of care and Lord Atkin\'s neighbour principle from Donoghue v Stevenson [1932] AC 562.',
        application: 'Because the bottle reached the consumer sealed and without reasonable intermediate inspection, harm to the consumer was foreseeable. The manufacturer had a duty not to negligently manufacture a product that could harm the consumer.',
        courtReasoning: 'Lord Atkin held that the manufacturer owed Mrs Donoghue a duty of care because she was so closely and directly affected by the manufacturer\'s acts that he ought reasonably to have had her in contemplation. The sealed opaque bottle prevented intermediate inspection, making the manufacturer the only party who could have prevented the harm.',
        decision: 'The House of Lords held that the manufacturer could owe a duty of care to the ultimate consumer, establishing the modern law of negligence.',
        ratiodecidendi: 'A manufacturer of products intended to reach the ultimate consumer in the form in which they left the manufacturer, with no reasonable possibility of intermediate examination, owes a duty of care to the consumer.',
        principle: 'You must take reasonable care to avoid acts or omissions which you can reasonably foresee would be likely to injure your neighbour — anyone closely and directly affected by your acts.',
        practicalApplication: 'This principle is the foundation of all negligence claims: product liability, professional negligence, road accidents. Every negligence case requires establishing duty, breach, causation, and damage.',
        examTips: 'Always state: (1) Duty of care — neighbour test, (2) Breach — did defendant fall below standard of reasonable person, (3) Causation — factual and legal (but-for test), (4) Damage — actual harm suffered. Distinguish Winterbottom v Wright on privity. Mention Caparo v Dickman for the three-part test.',
        authorities: ['Donoghue v Stevenson [1932] AC 562', 'Winterbottom v Wright (1842)', 'Heaven v Pender (1883)', 'Caparo Industries v Dickman [1990] AC 605'],
        sections: ['Negligence — Duty of Care', 'Breach of Duty', 'Causation (But-For Test)', 'Remoteness of Damage', 'Consumer Protection Act 2019 (India)'],
      };
    } else if (text.includes('kesavananda') || text.includes('bharati')) {
      profile = {
        caseName: 'Kesavananda Bharati v State of Kerala AIR 1973 SC 1461',
        natureOfDispute: 'Constitutional — scope of Parliament\'s amending power under Article 368',
        areaOfLaw: 'Constitutional Law — Basic Structure Doctrine',
        keyLegalIssue: 'Whether Article 368 permits Parliament to amend any provision in a way that destroys the Constitution\'s basic structure',
        difficultyLevel: 'Advanced — Landmark Constitutional Law',
        facts: 'The petition began with land reform challenges but became a constitutional contest over Parliament\'s power to amend the Constitution, particularly after the 24th and 25th Amendment Acts.',
        issues: 'Whether Article 368 permits Parliament to amend any provision in a way that destroys the Constitution\'s basic structure.',
        law: 'Article 368 must be read with constitutional supremacy, judicial review under Articles 13 and 32, and the earlier Golaknath v State of Punjab (1967) judgment.',
        application: 'Parliament may amend even fundamental rights, but cannot destroy essential constitutional identity such as democracy, federalism, secularism, rule of law, or judicial review.',
        courtReasoning: 'The Supreme Court (13-judge bench, 7:6) held that while Parliament has wide amending power under Article 368, this power cannot be used to damage, emasculate, or destroy the essential features or basic structure of the Constitution. The court derived this limitation from the concept of constitutional supremacy and the constituent power itself.',
        decision: 'The Supreme Court by 7:6 majority recognized the basic structure doctrine and held that Parliament cannot amend the Constitution so as to destroy its basic or essential features.',
        ratiodecidendi: 'Parliament\'s amending power under Article 368 is limited by the basic structure of the Constitution. Any amendment that destroys a basic feature is ultra vires and void.',
        principle: 'Amendment means alteration within continuity; it does not mean destruction of the Constitution\'s essential identity.',
        practicalApplication: 'The basic structure doctrine is invoked in every constitutional challenge to amendment acts. It protects democracy, judicial review, federalism, secularism, and fundamental rights from legislative destruction.',
        examTips: 'Mention the 13-judge bench. Cite Golaknath (1967) — Parliament had no power to amend FRs. Distinguish Sankari Prasad and Sajjan Singh (early view — Parliament had full power). Always list elements of basic structure: supremacy of Constitution, republican and democratic form, secular character, separation of powers, federalism, judicial review, individual freedom. Minerva Mills (1980) strengthened it.',
        authorities: ['Kesavananda Bharati v State of Kerala AIR 1973 SC 1461', 'Golaknath v State of Punjab AIR 1967 SC 1643', 'Sankari Prasad v Union of India AIR 1951 SC 458', 'Minerva Mills Ltd v Union of India AIR 1980 SC 1789', 'I.R. Coelho v State of Tamil Nadu (2007)'],
        sections: ['Article 368 — Power to amend', 'Article 13 — Laws inconsistent with FRs', 'Article 32 — Right to constitutional remedies', 'Article 19 — Fundamental Rights', 'Basic Structure Doctrine'],
      };
    } else if (text.includes('carlill') || text.includes('carbolic')) {
      profile = {
        caseName: 'Carlill v Carbolic Smoke Ball Co [1893] 1 QB 256',
        natureOfDispute: 'Contract — unilateral offer — acceptance by performance — consideration',
        areaOfLaw: 'Contract Law — Offer, Acceptance, Consideration',
        keyLegalIssue: 'Whether an advertisement can constitute a binding unilateral offer capable of acceptance by performance',
        difficultyLevel: 'Intermediate — Landmark Contract Law',
        facts: 'The company advertised a £100 reward for users of its smoke ball who caught influenza after using it as directed. The company deposited £1,000 in a bank to show seriousness. Mrs Carlill purchased and used the ball as directed, then caught influenza.',
        issues: 'Whether an advertisement can be a unilateral offer; whether performance of the advertised conditions constitutes acceptance; whether there is binding consideration; whether there is intention to create legal relations.',
        law: 'The relevant principles are offer, acceptance by performance (Section 8 Indian Contract Act 1872 for Indian context), intention to create legal relations, and consideration.',
        application: 'The deposit of £1,000 demonstrated serious intention. The nature of the unilateral offer waived separate notification of acceptance — performance was the acceptance. Buying and using the smoke ball was consideration by the promisee.',
        courtReasoning: 'The Court of Appeal held that the advertisement was a definite unilateral offer to the world, not mere puffery. The deposit showed genuine intention. Acceptance occurred by performance of the conditions. The court rejected the argument that there was no notification of acceptance — in unilateral contracts, the offeror waives the need for communication of acceptance.',
        decision: 'The Court of Appeal held that Mrs Carlill was entitled to the £100. A binding unilateral contract arose when she performed the advertised conditions.',
        ratiodecidendi: 'An advertisement offering a reward is a unilateral offer to the whole world; it can be accepted by any person who performs the specified conditions without prior notification of acceptance.',
        principle: 'A unilateral offer to the world can be accepted by complete performance of its specified conditions; no prior notification of acceptance is required.',
        practicalApplication: 'This principle governs reward advertisements, online clickwrap agreements, loyalty programs, and all unilateral contracts. Courts still apply Carlill to determine whether an advertisement is an offer or mere invitation to treat.',
        examTips: 'Distinguish offer from invitation to treat (Harvey v Facey, Fisher v Bell). Key elements: (1) Definite terms, (2) Intent shown by £1000 deposit, (3) Acceptance by performance, (4) Notification of acceptance waived, (5) Consideration — use of ball = consideration. In Indian context cite Section 8 ICA 1872. Address the "offeree must know of offer" issue.',
        authorities: ['Carlill v Carbolic Smoke Ball Co [1893] 1 QB 256', 'Williams v Carwardine (1833)', 'Harvey v Facey [1893] AC 552', 'Fisher v Bell [1961] 1 QB 394', 'Indian Contract Act 1872 Section 8'],
        sections: ['Offer vs Invitation to Treat', 'Unilateral Contract', 'Acceptance by Performance', 'Section 8 Contract Act 1872', 'Consideration', 'Intention to Create Legal Relations'],
      };
    }

    const scores: CaseReasoningScores = {
      overallLegalReasoning: finalScore,
      factIdentification: clampScore(finalScore + (isWrong ? -5 : 8)),
      issueSpotting: clampScore(finalScore + (isWrong ? -8 : 4)),
      lawApplication: clampScore(finalScore + (isWrong ? -12 : 2)),
      caseLawUsage: clampScore(finalScore + (profile.authorities.length > 2 ? 4 : -4)),
      professionalWriting: clampScore(finalScore + 3),
      argumentQuality: clampScore(finalScore + (isWrong ? -10 : 1)),
      criticalThinking: clampScore(finalScore + (isWrong ? -8 : 2)),
      argumentStrength: clampScore(finalScore + (isWrong ? -10 : 1)),
      finalScore,
      grade: gradeFromScore(finalScore),
    };

    const irrelevantNote = isIrrelevant ? 'The submission does not contain recognizable legal reasoning. Please write a genuine legal analysis covering facts, issues, applicable law, arguments, and conclusion.' : '';

    let modelLegalAnswerFallback = {
      issue: 'The central question is whether the action or measure, on the stated hypothetical facts, violates the applicable statutory or constitutional standards established under the governing precedent.',
      materialFacts: 'The material facts of the dispute involve a contest between the asserting party and the defending authority. The crucial facts concern the nature of the action, the specific rights affected, and the statutory provisions invoked. If key facts regarding intention or damage are missing, we assume standard operational conditions to apply.',
      legalFramework: 'The dispute is governed by the statutory provisions of the relevant Act and the precedent established by the landmark judgment. Under this framework, any exercise of power must align with both the text of the statute and the binding constitutional or common law limitations.',
      precedentApplication: 'The controlling precedent establishes the core legal test. Applying this test, the hypothetical scenario activates the binding principles since the facts directly mirror the legal relationship or issues decided in the landmark case. There are no material factual distinctions that would prevent the application of the rule.',
      petitionerCase: 'The petitioner would contend that the actions are in direct violation of the legal standard. Under the text and purpose of the governing rules, such a measure causes actionable harm and lacks valid authorization under the law.',
      respondentCase: 'The respondent State or defending party would argue that the action is fully authorized, falls squarely within statutory discretion, or is protected by valid legislative exemptions. The defense relies on the presumption of validity and the literal interpretation of the text.',
      rebuttal: 'In rebuttal, the petitioner can successfully argue that the defense is overly broad and fails to account for implicit limitations. The respondent\'s arguments are countered by showing that the exceptions cited do not apply to the core violation established on the facts.',
      likelyJudicialApproach: 'The court would approach this systematically: first, verify the source of power; second, identify the constitutional or statutory limitation; third, apply the precedent\'s test to the facts; fourth, weigh the competing arguments of counsel; and fifth, determine whether the relief sought is justified.',
      conclusion: 'On the stated facts, the stronger legal argument is that the challenge is sustainable if the violation is clearly demonstrated to fall outside permissible limits. Otherwise, the defense of statutory authorization will likely prevail.',
      remedyRelief: 'The petitioner is entitled to pray for appropriate declarations, directions, or remedies to set aside the impugned actions.',
      examTakeaway: 'Always identify the precise statutory provisions, apply the multi-part test of the landmark precedent, address counter-arguments, and qualify your final conclusion based on factual assumptions.'
    };

    if (text.includes('donoghue') || text.includes('stevenson')) {
      modelLegalAnswerFallback.issue = "The central issue is whether a manufacturer of a product owes a legal duty of care to the ultimate consumer to ensure the product is free from defect, in the absence of any contractual privity, where the product is sold in such a form as to show that it is intended to reach the consumer in the condition in which it left the manufacturer with no reasonable possibility of intermediate examination.";
      modelLegalAnswerFallback.materialFacts = "The material facts involve a consumer purchasing or consuming a manufactured item containing a hidden defect that causes physical or psychological injury. These facts matter because the lack of privity between the manufacturer and the consumer historically barred recovery in contract. If the facts do not show whether intermediate inspection was possible, we assume the packaging prevented any inspection prior to consumption.";
      modelLegalAnswerFallback.legalFramework = "The common law of negligence controls this dispute, specifically the manufacturer's liability in tort. Under the precedent established in Donoghue v. Stevenson [1932] AC 562, tort liability exists independently of contract. A duty is owed to anyone who is so closely and directly affected by an act that the actor ought reasonably to have them in contemplation.";
      modelLegalAnswerFallback.precedentApplication = "The 'neighbour principle' formulated by Lord Atkin controls: one must take reasonable care to avoid acts or omissions which can reasonably be foreseen to injure their neighbour. The hypothetical scenario activates this principle because the manufacturer placed a consumer product on the market with no intermediate inspection possible, creating a foreseeable risk of injury.";
      modelLegalAnswerFallback.petitionerCase = "The petitioner would contend that the manufacturer breached its duty of care by failing to maintain proper quality controls, resulting in the defective product. Relying on Lord Atkin's neighbour principle, the petitioner argues that the manufacturer had a direct duty to the ultimate consumer, and the absence of a contract is legally irrelevant to tortious liability.";
      modelLegalAnswerFallback.respondentCase = "The respondent manufacturer would argue that in the absence of a contract between the parties, no duty of care can arise under the doctrine of privity. The manufacturer might also contend that the defect was not foreseeable, that there was an opportunity for intermediate inspection, or that the plaintiff has failed to prove causation between the product and the alleged illness.";
      modelLegalAnswerFallback.rebuttal = "The petitioner rebuts the privity defense by establishing that tortious liability is independent of contract. If the product was sealed in an opaque container, intermediate inspection was practically impossible, making the manufacturer solely responsible for the safety of the contents. The respondent's causation defense can be answered with medical evidence linking the illness to the defect.";
      modelLegalAnswerFallback.likelyJudicialApproach = "The court would apply a multi-step negligence analysis: first, check if a duty of care exists under the neighbour test; second, determine if the manufacturer failed to exercise reasonable care (breach); third, establish if the breach directly caused the consumer's injury; fourth, check if the injury is too remote; and fifth, award damages if all elements are proven.";
      modelLegalAnswerFallback.conclusion = "The manufacturer is liable in negligence for the consumer's injuries if it is established that the product was defective when it left the factory and that the packaging excluded intermediate examination. If intermediate inspection was possible, the duty of care might be negated or shared.";
      modelLegalAnswerFallback.remedyRelief = "The petitioner should claim special and general damages in tort for the physical injury, medical expenses, and consequential loss caused by the manufacturer's negligence.";
      modelLegalAnswerFallback.examTakeaway = "Always address the lack of contractual privity first. Apply the neighbour principle and the intermediate inspection test to determine the manufacturer's liability.";
    } else if (text.includes('kesavananda') || text.includes('bharati')) {
      modelLegalAnswerFallback.issue = "The central question is whether the hypothetical constitutional amendment, despite being enacted through the formal procedure contemplated under Article 368, so alters a fundamental feature of the democratic republic that it damages or destroys the essential identity of the Constitution, thereby crossing the implicit limitations of the Basic Structure Doctrine.";
      modelLegalAnswerFallback.materialFacts = "The facts turn upon a state or central legislative measure amending the constitutional text. These facts are material because they directly affect the distribution of power, judicial review, or fundamental rights. Since the exact clause is not specified, we assume the amendment alters an essential feature, such as the separation of powers or judicial review. If the amendment merely tweaked a minor procedural rule, the basic structure challenge would fail.";
      modelLegalAnswerFallback.legalFramework = "Article 368 provides the formal mechanism for constitutional amendment, but the exercise of this constituent power is subject to the substantive limitation recognized by the Supreme Court in Kesavananda Bharati v. State of Kerala (1973). The decisive inquiry is not whether the procedural requirements of Article 368 are met, but whether the substantive outcome of the amendment destroys any essential features that form the basic structure of the Constitution.";
      modelLegalAnswerFallback.precedentApplication = "The principle of constitutional identity controls: the power to amend does not include the power to abrogate or replace the core framework. This principle is activated because the hypothetical amendment targets a fundamental tenet. The similarity lies in the legislative attempt to assert absolute sovereignty; the hypothetical scenario satisfies the threshold for judicial review under the basic structure test as established by the 13-judge bench.";
      modelLegalAnswerFallback.petitionerCase = "The petitioner would contend that the amendment is ultra vires because it eviscerates judicial review, which is a non-negotiable basic feature. Building on Kesavananda and Minerva Mills, the petitioner argues that Parliament cannot use its amending power to destroy the very limitations that preserve the democratic character and fundamental liberties guaranteed under the Constitution.";
      modelLegalAnswerFallback.respondentCase = "The respondent State would argue that Parliament represents the democratic will of the people and its amending power under Article 368 is constituent and supreme. The State would assert that the amendment is a necessary policy measure to achieve socio-economic justice, and that the basic structure doctrine should be interpreted narrowly so as not to paralyze legislative sovereignty.";
      modelLegalAnswerFallback.rebuttal = "The petitioner's response to the State's sovereignty argument is that the Constitution, not Parliament, is supreme. While Parliament has wide amending powers, it cannot use the power created by the Constitution to destroy the Constitution itself. The State's defense of socio-economic policy fails if the basic structure is destroyed, as no policy can justify the subversion of the rule of law.";
      modelLegalAnswerFallback.likelyJudicialApproach = "The court would systematically analyze the challenge: first, verify if the amendment followed Article 368 procedures; second, identify if the affected feature belongs to the basic structure; third, apply the 'width' and 'identity' tests to see if the feature is merely modified or completely damaged; fourth, evaluate the State's justification; and fifth, strike down the amendment if the threshold of damage is crossed.";
      modelLegalAnswerFallback.conclusion = "The amendment is substantively vulnerable if it impairs a core constitutional feature such as judicial review or fundamental rights. If the amendment merely alters an administrative detail without damaging the core identity, the judicial challenge will likely fail, preserving the amendment's validity.";
      modelLegalAnswerFallback.remedyRelief = "The petitioner should seek a declaration that the impugned amendment is unconstitutional, void ab initio, and ultra vires the amending power under Article 368 of the Constitution.";
      modelLegalAnswerFallback.examTakeaway = "Always emphasize constitutional supremacy over parliamentary sovereignty. Cite the 13-judge bench, Golaknath, and Minerva Mills, and explicitly use the basic structure identity test to solve the hypothetical.";
    } else if (text.includes('carlill') || text.includes('carbolic')) {
      modelLegalAnswerFallback.issue = "The central question is whether the defendant's public advertisement offering a reward constitutes a binding unilateral offer to the world at large which was accepted by Mrs. Carlill's performance of the conditions, thereby creating a contract supported by valid consideration and intent, despite the lack of notification of acceptance.";
      modelLegalAnswerFallback.materialFacts = "The material facts are the publication of the advertisement, the representation of sincerity (the £1,000 deposit), the plaintiff's purchase and use of the product, and the subsequent contract breach (catching influenza). These facts are material because they establish the offer's terms and the offeree's acceptance by performance. If the user did not follow directions, the breach of conditions would negate the claim.";
      modelLegalAnswerFallback.legalFramework = "The dispute is governed by the principles of contract formation under common law (and Section 8 of the Indian Contract Act, 1872). A unilateral contract arises when an offeror promises a benefit in exchange for the offeree performing a specific act, and performance of that act constitutes both acceptance and consideration.";
      modelLegalAnswerFallback.precedentApplication = "The landmark ruling in Carlill v. Carbolic Smoke Ball Co [1893] controls. The principle that unilateral offers to the world can be accepted by performance applies. The factual condition of Mrs. Carlill using the product as directed and catching flu satisfies the requirements, and the £1,000 deposit proves a binding intention to create legal relations.";
      modelLegalAnswerFallback.petitionerCase = "The petitioner would contend that the advertisement was not an invitation to treat but a unilateral offer. The deposit in the bank is conclusive evidence of intention to contract. In unilateral contracts, prior notification of acceptance is waived; Mrs. Carlill's performance of using the smoke ball was a valid acceptance and constitutes consideration.";
      modelLegalAnswerFallback.respondentCase = "The respondent company would argue that the advertisement was a mere sales puff with no contractual intent. They would assert that Mrs. Carlill failed to notify the company of her acceptance, that there was no agreement between the parties, and that she provided no consideration to the company.";
      modelLegalAnswerFallback.rebuttal = "The petitioner rebuts the 'sales puff' defense by pointing to the deposited £1,000, which demonstrates serious contractual intent. The company's claim of lack of notification is answered by showing that unilateral offers invite acceptance by performance, waiving communication. The consideration is established by Mrs. Carlill buying the product and using it as directed.";
      modelLegalAnswerFallback.likelyJudicialApproach = "The court would analyze the contract formation: first, check if the advertisement is an offer or invitation to treat; second, evaluate if the deposit shows intention; third, determine if notification of acceptance was waived; fourth, verify if performance constitutes acceptance and consideration; and fifth, enforce the promise if a valid contract is formed.";
      modelLegalAnswerFallback.conclusion = "Mrs. Carlill is entitled to recover the promised reward as a binding contract was formed by her performance. If she failed to follow the directions exactly, the unilateral contract would not be formed and the claim would fail.";
      modelLegalAnswerFallback.remedyRelief = "The petitioner should seek a decree for the recovery of the promised sum of £100 under the unilateral contract.";
      modelLegalAnswerFallback.examTakeaway = "Cite the £1,000 deposit as key evidence of intention to contract. Emphasize that in unilateral contracts, acceptance is communicated by performance of the conditions.";
    }

    return {
      caseNameOrProblem: topic,
      status: 'evaluated',
      createdAt: new Date().toISOString(),
      sections: {
        caseOverview: {
          caseName: profile.caseName,
          natureOfDispute: profile.natureOfDispute,
          areaOfLaw: profile.areaOfLaw,
          keyLegalIssue: profile.keyLegalIssue,
          difficultyLevel: profile.difficultyLevel,
        },
        understandingOfFacts: this.section(
          isIrrelevant ? irrelevantNote : `Your answer is assessed on whether it captures the legally operative facts in ${topic}.`,
          studentReasoning.length > 120 && !isIrrelevant ? ['You made a genuine attempt to narrate the dispute.'] : [],
          isIrrelevant ? ['No recognizable facts identified in the submission.'] : isWrong ? ['Some facts appear to be used to support an incorrect legal conclusion.'] : ['Material facts need sharper separation from background facts.'],
          ['List parties, legal relationship, disputed act or omission, harm, and procedural posture before moving to law.'],
        ),
        issueIdentification: this.section(
          isIrrelevant ? irrelevantNote : profile.issues,
          isIrrelevant ? [] : ['The answer identifies the broad legal theme.'],
          isIrrelevant ? ['No legal issues identified.'] : ['The issues should be framed as questions beginning with "whether".'],
          ['Separate legal, constitutional, statutory, procedural, and jurisdictional issues where applicable.'],
        ),
        applicableLaw: this.section(
          isIrrelevant ? irrelevantNote : profile.law,
          isIrrelevant ? [] : ['You attempted to connect the problem with legal rules.'],
          isIrrelevant ? ['No applicable law cited.'] : isWrong ? ['The controlling rule is misstated or overextended.'] : ['Some provisions or doctrinal elements require more exact naming.'],
          ['State the rule, identify each element, then apply each element to the facts.'],
        ),
        caseLawAnalysis: this.section(
          isIrrelevant ? irrelevantNote : `Relevant authorities include ${profile.authorities.join(', ')}.`,
          isIrrelevant ? [] : ['The answer recognizes that precedent matters.'],
          isIrrelevant ? ['No case law cited.'] : ['Binding precedent and supporting precedent should be distinguished. Explain why each precedent applies.'],
          ['Use landmark authority for the core rule. Explain the ratio of each case cited and why it applies here.'],
        ),
        legalReasoning: this.section(
          isIrrelevant ? irrelevantNote : profile.application,
          isIrrelevant ? [] : ['There is a visible attempt to reach a conclusion.'],
          isIrrelevant ? ['No legal reasoning present.'] : isWrong ? ['The conclusion does not follow from the governing principle.'] : ['Counter-arguments and exceptions need fuller treatment.'],
          ['Use IRAC or CRAC: Issue, Rule, Application, Counter-argument, Conclusion. An experienced lawyer always addresses the strongest counterargument before concluding.'],
        ),
        simplifiedExplanation: {
          facts: profile.facts,
          issues: profile.issues,
          law: profile.law,
          application: profile.application,
          reasoning: 'A senior answer moves slowly from fact to rule to application, tests the opposite side, then concludes. Each step must be shown explicitly.',
          courtReasoning: profile.courtReasoning,
          decision: profile.decision,
          ratiodecidendi: profile.ratiodecidendi,
          legalPrinciple: profile.principle,
          practicalApplication: profile.practicalApplication,
          examTips: profile.examTips,
          realLifeExample: 'Think of a sealed consumer product, a constitutional rulebook, or an advertisement with a reward: liability or legality depends on who is foreseeably affected and whether the governing rule is preserved.',
        },
        mistakes: isIrrelevant
          ? ['No legal reasoning was detected in the submission. The text does not contain facts, issues, applicable law, arguments, or a conclusion.', 'Please write a genuine legal analysis of the case.']
          : isWrong
          ? ['The governing legal principle is misstated.', 'The answer misses binding authority.', 'The reasoning jumps from assertion to conclusion without legal application.', 'Counter-arguments are not addressed.']
          : ['Some issues are too broadly framed — use "whether" questions.', 'Authorities need stronger hierarchy — distinguish binding from persuasive.', 'Counter-arguments should be developed before the final conclusion.', 'The ratio decidendi of cited cases is not explained.'],
        modelLegalAnswer: modelLegalAnswerFallback,
        professionalSolution: `PROFESSIONAL MODEL ANSWER: ${topic}\n\nFACTS:\n${profile.facts}\n\nISSUES:\n${profile.issues}\n\nAPPLICABLE LAW:\n${profile.law}\n\nLEGAL ANALYSIS:\n${profile.application}\n\nCOURT'S REASONING:\n${profile.courtReasoning}\n\nDECISION:\n${profile.decision}\n\nRATIO DECIDENDI:\n${profile.ratiodecidendi}\n\nLEGAL PRINCIPLE:\n${profile.principle}\n\nPRACTICAL APPLICATION:\n${profile.practicalApplication}`,
        bestCaseReport: {
          title: `Ideal Case Analysis: ${topic}`,
          introduction: `This report sets out the best way to analyze ${topic} for academic, exam, and professional legal reasoning. It focuses on material facts, precise issues, governing law, precedent, application, counter-arguments, conclusion, and the legal principle.`,
          facts: [profile.facts],
          issues: [profile.issues],
          applicableLaw: [profile.law, ...profile.sections],
          caseLaw: profile.authorities,
          analysis: `The correct analysis starts with the legal relationship and the exact rule. ${profile.application} A strong answer does not merely state the result; it explains why the governing rule applies to the material facts and why contrary arguments should not prevail.`,
          counterArguments: ['The opposite side may argue that the rule should be read narrowly or that a different provision governs.', 'A strong answer should distinguish weak authorities, address exceptions, and rebut counter-arguments before concluding.'],
          conclusion: profile.decision,
          legalPrinciple: profile.principle,
          examReadyAnswer: `In ${topic}, the legally significant facts are as follows: ${profile.facts}\n\nThe principal issue is: ${profile.issues}\n\nThe applicable law is: ${profile.law}\n\nApplying the law: ${profile.application}\n\nThe court reasoned: ${profile.courtReasoning}\n\nTherefore: ${profile.decision}\n\nRatio Decidendi: ${profile.ratiodecidendi}\n\nThe governing legal principle is: ${profile.principle}\n\nExam Tips: ${profile.examTips}`,
        },
        learningRecommendations: {
          whatStudentDidWell: isIrrelevant ? ['Attempted to engage with the simulator'] : studentReasoning.length > 120 ? ['Made a genuine effort to analyze the case', 'Attempted to structure the answer'] : ['Identified the case topic'],
          whatToImprove: isIrrelevant ? ['Write actual legal reasoning covering facts, issues, law, application, and conclusion', 'Use legal vocabulary and cite specific provisions'] : isWrong ? ['Correct the fundamental misstatement of the governing rule', 'Cite binding authority before drawing conclusions'] : ['Sharpen issue framing using "whether" questions', 'Cite authority with hierarchy', 'Develop counter-arguments', 'State the ratio decidendi of each case cited'],
          relatedBareActs: text.includes('donoghue') || text.includes('stevenson') ? ['Consumer Protection Act, 2019', 'Law of Torts — General Principles'] : text.includes('carlill') || text.includes('carbolic') ? ['Indian Contract Act, 1872', 'Sale of Goods Act, 1930'] : text.includes('kesavananda') || text.includes('bharati') ? ['Constitution of India', 'Article 368 — Amendment Procedure'] : ['Relevant subject Bare Act', 'Constitution of India'],
          relatedSections: profile.sections,
          relatedCases: profile.authorities,
          relatedMockTests: ['Issue spotting practice — frame 5 issues as "whether" questions', 'IRAC answer writing drill', 'Precedent hierarchy quiz', 'Counter-argument development exercise'],
          relatedFlashcards: ['Material facts vs background facts', 'Ratio decidendi vs obiter dicta', 'Duty of care — neighbour test', 'Counter-argument structure', 'Binding vs persuasive precedent'],
          relatedResearchTopics: ['Authority hierarchy in Indian courts', 'How to distinguish precedents', 'Comparative case analysis method', 'IRAC vs CRAC vs CREAC structures'],
        },
        performanceScore: scores,
      },
      professorComments: isIrrelevant
        ? 'This submission does not contain legal reasoning. The Professor Review Lab requires you to write a genuine legal analysis — cover the facts, frame the issues, cite the applicable law, apply the law to the facts, address counter-arguments, and state a conclusion. Please attempt the case properly and resubmit.'
        : isWrong
        ? 'This answer needs correction at the level of first principle. The effort is useful, but you must rebuild the analysis around the controlling rule and binding authority. Do not state conclusions without applying the governing rule to the specific facts.'
        : 'This is a serious attempt. To make it examination-ready: (1) sharpen issue framing using "whether" questions, (2) cite authority in hierarchy explaining the ratio of each case, (3) show the full chain from rule to application, (4) develop counter-arguments before concluding, (5) state the ratio decidendi explicitly.',
      provider: 'local-fallback',
    };
  }
}

import { RetrievalCache } from '../cache/RetrievalCache';
import { ContextCompressor } from '../ranking/ContextCompressor';
import { KnowledgeRanker } from '../ranking/KnowledgeRanker';
import { TokenBudgetManager } from '../ranking/TokenBudgetManager';
import {
  AssessmentRetriever,
  BareActRetriever,
  BehaviourRuleRetriever,
  CapstoneRetriever,
  CurriculumRetriever,
  DraftRetriever,
  FeedbackRetriever,
  LessonRetriever,
  MasteryRetriever,
  PatternRetriever,
  PromptModuleRetriever,
  RevisionRetriever,
  StudentContextRetriever,
  TeachingRuleRetriever,
  WeaknessRetriever,
} from '../retrievers';
import type {
  EmbeddingService,
  KnowledgeKind,
  KnowledgeRepository,
  KnowledgeRetrievalRequest,
  KnowledgeRetrievalResult,
  RetrievalCandidate,
  RetrieverPlan,
} from '../types';
import { parseKnowledgeRetrievalRequest, parseRetrievalQuery } from '../validators/schemas';

type RetrieverName =
  | 'curriculum'
  | 'lesson'
  | 'studentContext'
  | 'mastery'
  | 'weakness'
  | 'draft'
  | 'revision'
  | 'feedback'
  | 'pattern'
  | 'bareAct'
  | 'assessment'
  | 'capstone'
  | 'promptModule'
  | 'teachingRule'
  | 'behaviourRule';

type RetrieverInstance =
  | CurriculumRetriever
  | LessonRetriever
  | StudentContextRetriever
  | MasteryRetriever
  | WeaknessRetriever
  | DraftRetriever
  | RevisionRetriever
  | FeedbackRetriever
  | PatternRetriever
  | BareActRetriever
  | AssessmentRetriever
  | CapstoneRetriever
  | PromptModuleRetriever
  | TeachingRuleRetriever
  | BehaviourRuleRetriever;

export interface KnowledgeRetrievalEngineOptions {
  repository: KnowledgeRepository;
  embeddingService: EmbeddingService;
  cache?: RetrievalCache;
  ranker?: KnowledgeRanker;
  tokenBudgetManager?: TokenBudgetManager;
  compressor?: ContextCompressor;
  maxParallelPlans?: number;
}

export class KnowledgeRetrievalEngine {
  private readonly repository: KnowledgeRepository;
  private readonly embeddingService: EmbeddingService;
  private readonly cache: RetrievalCache;
  private readonly ranker: KnowledgeRanker;
  private readonly tokenBudgetManager: TokenBudgetManager;
  private readonly compressor: ContextCompressor;
  private readonly retrievers: Record<RetrieverName, RetrieverInstance>;
  private readonly maxParallelPlans: number;

  constructor(options: KnowledgeRetrievalEngineOptions) {
    this.repository = options.repository;
    this.embeddingService = options.embeddingService;
    this.cache = options.cache ?? new RetrievalCache();
    this.ranker = options.ranker ?? new KnowledgeRanker();
    this.tokenBudgetManager = options.tokenBudgetManager ?? new TokenBudgetManager();
    this.compressor = options.compressor ?? new ContextCompressor();
    this.maxParallelPlans = options.maxParallelPlans ?? 6;
    this.retrievers = {
      curriculum: new CurriculumRetriever(),
      lesson: new LessonRetriever(),
      studentContext: new StudentContextRetriever(),
      mastery: new MasteryRetriever(),
      weakness: new WeaknessRetriever(),
      draft: new DraftRetriever(),
      revision: new RevisionRetriever(),
      feedback: new FeedbackRetriever(),
      pattern: new PatternRetriever(),
      bareAct: new BareActRetriever(),
      assessment: new AssessmentRetriever(),
      capstone: new CapstoneRetriever(),
      promptModule: new PromptModuleRetriever(),
      teachingRule: new TeachingRuleRetriever(),
      behaviourRule: new BehaviourRuleRetriever(),
    };
  }

  retrieveForLearning(request: KnowledgeRetrievalRequest): Promise<KnowledgeRetrievalResult> {
    return this.retrieve(request, ['curriculum', 'lesson', 'pattern', 'teachingRule', 'behaviourRule']);
  }

  retrieveForDrafting(request: KnowledgeRetrievalRequest): Promise<KnowledgeRetrievalResult> {
    return this.retrieve(request, ['curriculum', 'lesson', 'studentContext', 'weakness', 'pattern', 'draft', 'teachingRule']);
  }

  retrieveForReview(request: KnowledgeRetrievalRequest): Promise<KnowledgeRetrievalResult> {
    return this.retrieve(request, ['studentContext', 'mastery', 'weakness', 'draft', 'feedback', 'pattern', 'teachingRule', 'behaviourRule']);
  }

  retrieveForRevision(request: KnowledgeRetrievalRequest): Promise<KnowledgeRetrievalResult> {
    return this.retrieve(request, ['studentContext', 'weakness', 'draft', 'revision', 'feedback', 'pattern']);
  }

  retrieveForQuiz(request: KnowledgeRetrievalRequest): Promise<KnowledgeRetrievalResult> {
    return this.retrieve(request, ['curriculum', 'lesson', 'mastery', 'weakness', 'assessment', 'teachingRule']);
  }

  retrieveForAssessment(request: KnowledgeRetrievalRequest): Promise<KnowledgeRetrievalResult> {
    return this.retrieve(request, ['curriculum', 'lesson', 'mastery', 'assessment', 'teachingRule', 'behaviourRule']);
  }

  retrieveForCapstone(request: KnowledgeRetrievalRequest): Promise<KnowledgeRetrievalResult> {
    return this.retrieve(request, ['capstone', 'studentContext', 'mastery', 'weakness', 'draft', 'revision', 'feedback', 'pattern', 'assessment']);
  }

  retrieveForBareActAnalysis(request: KnowledgeRetrievalRequest): Promise<KnowledgeRetrievalResult> {
    return this.retrieve(request, ['bareAct', 'pattern', 'curriculum', 'lesson', 'teachingRule']);
  }

  private async retrieve(requestInput: KnowledgeRetrievalRequest, retrieverNames: RetrieverName[]): Promise<KnowledgeRetrievalResult> {
    const request = parseKnowledgeRetrievalRequest(requestInput);
    const selectedKinds = request.includeKinds;
    const activeRetrievers = retrieverNames
      .map((name) => this.retrievers[name])
      .filter((retriever) => this.matchesIncludedKinds(retriever.kinds, selectedKinds));

    const cacheKey = this.cache.buildKey({
      intent: request.intent,
      strategy: request.teachingStrategy,
      message: request.normalizedMessage ?? request.userMessage,
      userId: request.userId,
      moduleId: request.moduleId,
      lessonId: request.lessonId,
      projectId: request.projectId,
      draftId: request.draftId,
      retrievers: activeRetrievers.map((retriever) => retriever.name),
      includeKinds: selectedKinds,
      tokenBudget: request.tokenBudget,
    });

    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const plans = activeRetrievers.map((retriever) => retriever.buildPlan(request));
    const warnings: string[] = [];
    const candidates = await this.executePlans(plans, warnings);
    const ranked = this.ranker.dedupe(this.ranker.rank(candidates, request));
    const tokenBudget = request.tokenBudget ?? this.defaultTokenBudget(request.intent);
    const compressed = this.compressor.compress(
      ranked.map((candidate) => ({
        id: candidate.document.id,
        kind: candidate.document.kind,
        title: candidate.document.title,
        content: candidate.document.content,
        metadata: candidate.document.metadata,
        score: candidate.finalScore,
        reasons: candidate.reasons,
        tokenEstimate: this.tokenBudgetManager.estimateTokens(candidate.document.content),
      })),
      Math.max(250, Math.floor(tokenBudget / Math.max(1, activeRetrievers.length)))
    );
    const budgeted = this.tokenBudgetManager.select(
      compressed.map((item) => ({
        document: {
          id: item.id,
          kind: item.kind,
          title: item.title,
          content: item.content,
          metadata: item.metadata,
        },
        finalScore: item.score,
        reasons: item.reasons,
      })),
      tokenBudget
    );

    const result: KnowledgeRetrievalResult = {
      intent: request.intent,
      teachingStrategy: request.teachingStrategy,
      query: request.normalizedMessage ?? request.userMessage,
      items: budgeted.items,
      omitted: budgeted.omitted,
      tokenBudget,
      usedTokens: budgeted.usedTokens,
      warnings,
    };

    this.cache.set(cacheKey, result);
    return result;
  }

  private async executePlans(plans: RetrieverPlan[], warnings: string[]): Promise<RetrievalCandidate[]> {
    const embeddingMemo = new Map<string, Promise<number[]>>();
    const chunks = this.chunkPlans(plans, this.maxParallelPlans);
    const all: RetrievalCandidate[] = [];

    for (const chunk of chunks) {
      const settled = await Promise.all(chunk.map((plan) => this.executePlan(plan, embeddingMemo)));
      for (const result of settled) {
        warnings.push(...result.warnings);
        all.push(...result.candidates);
      }
    }

    return all;
  }

  private async executePlan(plan: RetrieverPlan, embeddingMemo: Map<string, Promise<number[]>>): Promise<{ candidates: RetrievalCandidate[]; warnings: string[] }> {
    const query = parseRetrievalQuery(plan.query);
    const candidates: RetrievalCandidate[] = [];
    const warnings: string[] = [];

    try {
      if (query.mode === 'vector' || query.mode === 'hybrid') {
        const embedding = await this.getEmbedding(query.text, embeddingMemo);
        candidates.push(...await this.repository.searchVector(query, embedding));
      }
    } catch (error) {
      warnings.push(`${plan.retrieverName} vector retrieval failed; keyword fallback used. ${this.errorMessage(error)}`);
    }

    if (query.mode === 'keyword' || query.mode === 'hybrid') {
      try {
        candidates.push(...await this.repository.searchKeyword(query));
      } catch (error) {
        warnings.push(`${plan.retrieverName} keyword retrieval failed. ${this.errorMessage(error)}`);
      }
    }

    if (query.requiredIds?.length) {
      try {
        const required = await this.repository.getByIds(query.requiredIds);
        candidates.push(...required.map((document) => ({ document, finalScore: 1, reasons: ['required_id'] })));
      } catch (error) {
        warnings.push(`${plan.retrieverName} required-id retrieval failed. ${this.errorMessage(error)}`);
      }
    }

    return { candidates, warnings };
  }

  private getEmbedding(text: string, embeddingMemo: Map<string, Promise<number[]>>): Promise<number[]> {
    const key = text.trim().toLowerCase();
    const existing = embeddingMemo.get(key);
    if (existing) return existing;
    const pending = this.embeddingService.generateEmbedding(text);
    embeddingMemo.set(key, pending);
    return pending;
  }

  private chunkPlans(plans: RetrieverPlan[], size: number): RetrieverPlan[][] {
    const chunks: RetrieverPlan[][] = [];
    for (let index = 0; index < plans.length; index += size) chunks.push(plans.slice(index, index + size));
    return chunks;
  }

  private matchesIncludedKinds(kinds: KnowledgeKind[], selectedKinds?: KnowledgeKind[]): boolean {
    if (!selectedKinds?.length) {
      return true;
    }

    return kinds.some((kind) => selectedKinds.includes(kind));
  }

  private defaultTokenBudget(intent: KnowledgeRetrievalRequest['intent']): number {
    if (intent === 'capstone') return 4500;
    if (intent === 'review' || intent === 'revision') return 3000;
    if (intent === 'assessment') return 2500;
    return 2200;
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}

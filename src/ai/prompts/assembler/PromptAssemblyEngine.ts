import type { PromptAssemblyEngineContract } from '../interfaces';
import type { AssembledPrompt, PromptAssemblyRequest } from '../types';
import { validatePromptAssemblyRequest } from '../schemas';
import { BareActAnalysisModule } from '../modules/BareActAnalysisModule';
import { BehaviourModule } from '../modules/BehaviourModule';
import { CapstoneModule } from '../modules/CapstoneModule';
import { CoreModule } from '../modules/CoreModule';
import { CurriculumModule } from '../modules/CurriculumModule';
import { DraftReviewModule } from '../modules/DraftReviewModule';
import { LessonModule } from '../modules/LessonModule';
import { OutputFormattingModule } from '../modules/OutputFormattingModule';
import { PatternModule } from '../modules/PatternModule';
import { SafetyModule } from '../modules/SafetyModule';
import { StudentContextModule } from '../modules/StudentContextModule';
import { TeachingStrategyModule } from '../modules/TeachingStrategyModule';
import { PromptBudgetManager } from './PromptBudgetManager';
import { PromptConflictResolver } from './PromptConflictResolver';
import { PromptRenderer } from './PromptRenderer';
import { PromptSelector } from './PromptSelector';

export class PromptAssemblyEngine implements PromptAssemblyEngineContract {
  private readonly assemblyCache = new Map<string, AssembledPrompt>();
  private readonly maxCacheEntries = 250;
  private readonly selector = new PromptSelector([
    new CoreModule(),
    new SafetyModule(),
    new BehaviourModule(),
    new TeachingStrategyModule(),
    new CurriculumModule(),
    new StudentContextModule(),
    new LessonModule(),
    new DraftReviewModule(),
    new PatternModule(),
    new BareActAnalysisModule(),
    new CapstoneModule(),
    new OutputFormattingModule(),
  ]);

  private readonly conflictResolver = new PromptConflictResolver();
  private readonly budgetManager = new PromptBudgetManager();
  private readonly renderer = new PromptRenderer();

  assemble(request: PromptAssemblyRequest): AssembledPrompt {
    const cacheKey = this.buildCacheKey(request);
    const cached = this.assemblyCache.get(cacheKey);
    if (cached) {
      this.assemblyCache.delete(cacheKey);
      this.assemblyCache.set(cacheKey, cached);
      return cached;
    }

    const validation = validatePromptAssemblyRequest(request);
    const warnings = [...validation.errors];
    const selected = this.selector.select(request);
    const builtFragments = selected.included.map((module) => module.build(request));
    const resolved = this.conflictResolver.resolve(builtFragments, request);
    warnings.push(...resolved.warnings);

    const budget = request.totalTokenBudget ?? 6000;
    const budgeted = this.budgetManager.enforceBudget(resolved.fragments, budget);
    warnings.push(...budgeted.warnings);

    const prompt = this.renderer.render(budgeted.fragments, request);
    const assembled: AssembledPrompt = {
      prompt,
      fragments: budgeted.fragments,
      estimatedTokens: this.budgetManager.estimateTokens(prompt),
      omittedModules: selected.omitted,
      warnings,
    };
    this.remember(cacheKey, assembled);
    return assembled;
  }

  private remember(key: string, value: AssembledPrompt): void {
    if (this.assemblyCache.size >= this.maxCacheEntries) {
      const oldest = this.assemblyCache.keys().next().value;
      if (oldest) this.assemblyCache.delete(oldest);
    }
    this.assemblyCache.set(key, value);
  }

  private buildCacheKey(request: PromptAssemblyRequest): string {
    return JSON.stringify({
      userMessage: request.normalizedMessage ?? request.userMessage,
      intent: request.intent,
      teachingStrategy: request.teachingStrategy,
      productName: request.productName,
      platformName: request.platformName,
      defaultJurisdiction: request.defaultJurisdiction,
      curriculum: request.curriculum,
      student: request.student,
      patterns: request.patterns,
      bareAct: request.bareAct,
      draft: request.draft,
      capstone: request.capstone,
      safety: request.safety,
      output: request.output,
      educationalReasoning: request.educationalReasoning,
      totalTokenBudget: request.totalTokenBudget,
    });
  }
}


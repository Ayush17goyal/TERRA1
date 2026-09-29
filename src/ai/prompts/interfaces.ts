import type {
  AssembledPrompt,
  PromptAssemblyRequest,
  PromptModuleFragment,
  PromptModuleName,
} from './types';

export interface PromptModule {
  readonly name: PromptModuleName;
  shouldInclude(request: PromptAssemblyRequest): boolean;
  build(request: PromptAssemblyRequest): PromptModuleFragment;
}

export interface PromptSelectorContract {
  select(request: PromptAssemblyRequest): {
    included: PromptModule[];
    omitted: PromptModuleName[];
  };
}

export interface PromptBudgetManagerContract {
  estimateTokens(text: string): number;
  enforceBudget(
    fragments: PromptModuleFragment[],
    totalBudget: number
  ): {
    fragments: PromptModuleFragment[];
    estimatedTokens: number;
    warnings: string[];
  };
}

export interface PromptConflictResolverContract {
  resolve(
    fragments: PromptModuleFragment[],
    request: PromptAssemblyRequest
  ): {
    fragments: PromptModuleFragment[];
    warnings: string[];
  };
}

export interface PromptRendererContract {
  render(
    fragments: PromptModuleFragment[],
    request: PromptAssemblyRequest
  ): string;
}

export interface PromptAssemblyEngineContract {
  assemble(request: PromptAssemblyRequest): AssembledPrompt;
}

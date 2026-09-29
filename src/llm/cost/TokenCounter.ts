import type { AssembledPrompt, PromptModuleFragment } from '../../ai/prompts/types';
import type { LLMUsage, OpenAIResponseResult } from '../types';

export class TokenCounter {
  estimate(text: string): number {
    return Math.ceil(text.length / 4);
  }

  fromResponse(prompt: AssembledPrompt, response: OpenAIResponseResult, completionText: string): LLMUsage {
    const fragments = prompt.fragments;
    const usage = response.usage ?? {};
    const inputTokens = usage.input_tokens ?? prompt.estimatedTokens;
    const outputTokens = usage.output_tokens ?? this.estimate(completionText);

    return {
      inputTokens,
      outputTokens,
      totalTokens: usage.total_tokens ?? inputTokens + outputTokens,
      systemPromptTokens: this.sumFragments(fragments, ['core', 'safety', 'behaviour', 'teaching_strategy', 'output_formatting']),
      knowledgeTokens: this.sumFragments(fragments, ['curriculum', 'lesson', 'pattern', 'bare_act_analysis', 'capstone']),
      studentContextTokens: this.sumFragments(fragments, ['student_context']),
      draftTokens: this.sumFragments(fragments, ['draft_review']),
    };
  }

  private sumFragments(fragments: PromptModuleFragment[], names: string[]): number {
    return fragments
      .filter((fragment) => names.includes(fragment.moduleName))
      .reduce((sum, fragment) => sum + this.estimate(fragment.instructions), 0);
  }
}

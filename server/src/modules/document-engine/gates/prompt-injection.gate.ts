import { Injectable } from '@nestjs/common';

// architecture.md §3.3 / §15: "Prompt-injection isolation: every LLM call in Stages 5-10 treats
// extracted document text as strictly delimited data, never as instruction context. Any
// classifier output ... falling outside its expected schema/taxonomy is rejected."
//
// This module's understanding stages (topic-detection, definition-extraction, etc.) are
// implemented with deterministic pattern/heuristic classifiers (see stages/*.stage.ts), not
// live LLM calls, so there is no prompt string for untrusted document text to be concatenated
// into today. This gate exists as the enforced contract for the moment an LLM call is added to
// any stage (e.g. swapping the taxonomy heuristic for a real classifier) — every such call MUST
// route its document-derived input through `sanitizeForPrompt` and validate the response through
// `validateClassifierOutput` before trusting it.
@Injectable()
export class PromptInjectionGate {
  // Strips/escapes instruction-like patterns from document-derived text before it is ever
  // interpolated into an LLM prompt. Does not alter meaning for legitimate legal text.
  sanitizeForPrompt(text: string): string {
    return text
      .replace(/```/g, '```') // neutralize fenced code-block breakout
      .replace(/\b(ignore|disregard)\s+(?:(?:all|previous|prior|above)\s+){1,3}(instructions?|prompts?)\b/gi, '[redacted-instruction-like-text]')
      .replace(/\b(system|developer|assistant|tool)\s*:\s*/gi, '[redacted-role]: ')
      .slice(0, 8000); // bound the amount of untrusted text any single call can inject
  }

  // Rejects a classifier's output if it doesn't conform to the expected closed schema
  // (e.g. a topic tag that isn't in the taxonomy, or a confidence outside [0,1]).
  validateClassifierOutput<T extends { confidence?: number }>(
    output: T,
    allowedValues: string[],
    valueField: keyof T,
  ): boolean {
    const value = output[valueField];
    if (typeof value !== 'string' || !allowedValues.includes(value)) return false;
    if (typeof output.confidence === 'number' && (output.confidence < 0 || output.confidence > 1)) return false;
    return true;
  }
}

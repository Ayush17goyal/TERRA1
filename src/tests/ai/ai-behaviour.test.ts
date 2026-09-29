import { describe, expect, it } from 'vitest';
import { PromptAssemblyEngine } from '../../ai/prompts/assembler/PromptAssemblyEngine';
import { ResponseValidator } from '../../validator/engine/ResponseValidator';
import { llmResponse, promptRequest, runtimePacket } from '../fixtures/mentor-fixtures';

describe('AI behaviour regression tests', () => {
  it('keeps assessment assistance inside review-only boundaries', () => {
    const packet = runtimePacket({ intent: 'assessment', promptRequest: promptRequest({ intent: 'assessment', teachingStrategy: 'assessment_feedback', safety: { assessmentMode: true, allowedAssistanceLevel: 'review_only' } }) });
    const outcome = new ResponseValidator().validate(packet, llmResponse('Learning objective: assess your submitted clause. Weaknesses: missing duty-holder. Next action: revise the submitted clause.'));
    expect(outcome.violations.some((violation) => violation.ruleId === 'assessment_boundary' && violation.severity === 'BLOCKING')).toBe(false);
  });

  it('detects hallucinated unsupported statutory citations', () => {
    const packet = runtimePacket({ promptRequest: promptRequest({ safety: { sourceGroundingStatus: 'none' } }) });
    const outcome = new ResponseValidator().validate(packet, llmResponse('Learning objective: cite law. Section 999 of the Imaginary Regulation Act, 2099 proves it. Next action: verify source.'));
    expect(outcome.violations.some((violation) => violation.ruleId === 'hallucination')).toBe(true);
  });

  it('assembles prompts with explicit teaching strategy and next-action requirements', () => {
    const prompt = new PromptAssemblyEngine().assemble(promptRequest({ teachingStrategy: 'hint', output: { requiredSections: ['Hint', 'Next action'], includeNextAction: true } }));
    expect(prompt.prompt).toContain('Selected teaching strategy');
    expect(prompt.prompt).toContain('Next action');
  });
});

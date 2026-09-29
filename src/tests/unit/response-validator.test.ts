import { describe, expect, it } from 'vitest';
import { ResponseValidator } from '../../validator/engine/ResponseValidator';
import { llmResponse, runtimePacket } from '../fixtures/mentor-fixtures';

describe('Educational ResponseValidator', () => {
  it('approves educational feedback with objective and next action', () => {
    const outcome = new ResponseValidator().approve(runtimePacket(), llmResponse());
    expect(outcome.approved).toBe(true);
    expect(outcome.action).toBe('approve');
  });

  it('blocks complete statutory ghostwriting in drafting contexts', () => {
    const packet = runtimePacket({ intent: 'drafting', promptRequest: { intent: 'drafting', teachingStrategy: 'teach', userMessage: 'Draft my Act', student: { level: 'beginner' }, safety: { riskFlags: ['complete_bare_act_request'] } } as any });
    const text = 'Section 1 Short title.\nSection 2 Definitions.\nSection 3 Duties.\nSection 4 Powers.\nSection 5 Penalties.';
    const outcome = new ResponseValidator().validate(packet, llmResponse(text));
    expect(outcome.violations.some((violation) => violation.ruleId === 'no_ghostwriting' || violation.ruleId === 'bare_act_boundary')).toBe(true);
    expect(['request_regeneration', 'block_response']).toContain(outcome.action);
  });
});

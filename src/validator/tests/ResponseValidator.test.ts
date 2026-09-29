import type { LLMResponse, RuntimeDecisionPacket } from '../../llm/types';
import { ResponseValidator } from '../engine/ResponseValidator';

function packet(overrides: Partial<RuntimeDecisionPacket> = {}): RuntimeDecisionPacket {
  return {
    requestId: 'req-validator-1',
    interactionId: 'interaction-1',
    studentId: 'student-1',
    intent: 'review',
    teachingStrategy: 'review',
    promptRequest: {
      userMessage: 'Review my clause.',
      intent: 'review',
      teachingStrategy: 'review',
      student: { level: 'intermediate' },
      draft: {
        text: 'Every person shall comply.',
        objective: 'Create a duty.',
      },
      output: {
        requiredSections: ['Strengths', 'Weaknesses', 'Next action'],
      },
    },
    ...overrides,
  };
}

function response(text: string): LLMResponse {
  return {
    requestId: 'req-validator-1',
    interactionId: 'interaction-1',
    text,
    model: 'gpt-test',
    prompt: {
      prompt: 'assembled prompt',
      fragments: [],
      estimatedTokens: 10,
      omittedModules: [],
      warnings: [],
    },
    toolCalls: [],
    usage: {
      inputTokens: 10,
      outputTokens: 10,
      totalTokens: 20,
      systemPromptTokens: 5,
      knowledgeTokens: 0,
      studentContextTokens: 0,
      draftTokens: 5,
    },
    cost: {
      model: 'gpt-test',
      inputCostUsd: 0,
      outputCostUsd: 0,
      estimatedCostUsd: 0,
      completionLength: text.length,
    },
    telemetry: {
      requestId: 'req-validator-1',
      interactionId: 'interaction-1',
      intent: 'review',
      teachingStrategy: 'review',
      promptVersion: 'test',
      model: 'gpt-test',
      latencyMs: 1,
      retryCount: 0,
      cacheHit: false,
      toolCalls: [],
      usage: {
        inputTokens: 10,
        outputTokens: 10,
        totalTokens: 20,
        systemPromptTokens: 5,
        knowledgeTokens: 0,
        studentContextTokens: 0,
        draftTokens: 5,
      },
      cost: {
        model: 'gpt-test',
        inputCostUsd: 0,
        outputCostUsd: 0,
        estimatedCostUsd: 0,
        completionLength: text.length,
      },
    },
    raw: {},
  };
}

export function testBlocksCompleteBareActGeneration(): void {
  const validator = new ResponseValidator();
  const outcome = validator.validate(
    packet({
      intent: 'drafting',
      teachingStrategy: 'teach',
      promptRequest: {
        userMessage: 'Draft a full Bare Act.',
        intent: 'drafting',
        teachingStrategy: 'teach',
        safety: { riskFlags: ['complete_bare_act_request'] },
      },
    }),
    response('Complete Bare Act drafted below\n\nSection 1 Short title\nSection 2 Definitions\nSection 3 Duties')
  );

  assert(outcome.action === 'block_response', 'Expected full Bare Act generation to be blocked.');
}

export function testRepairsMissingNextActionAndHeadings(): void {
  const validator = new ResponseValidator();
  const output = response('Because the duty-holder is unclear, the legal effect is uncertain.');
  const outcome = validator.approve(packet(), output);

  assert(outcome.action === 'approve', 'Expected repair to lead to approval.');
  assert(Boolean(outcome.repairedText?.includes('Next action')), 'Expected next action repair.');
  assert(Boolean(outcome.repairedText?.includes('Strengths')), 'Expected heading repair.');
}

export function testRequestsRegenerationForFabricatedCitation(): void {
  const validator = new ResponseValidator();
  const outcome = validator.validate(
    packet({
      intent: 'learning',
      teachingStrategy: 'teach',
      promptRequest: {
        userMessage: 'Explain this.',
        intent: 'learning',
        teachingStrategy: 'teach',
        safety: { sourceGroundingStatus: 'none' },
      },
    }),
    response('Because section 12 of the Imaginary Drafting Act, 2029 requires this, you should follow it. Next action: revise.')
  );

  assert(outcome.action === 'request_regeneration', 'Expected unsupported citation to request regeneration.');
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

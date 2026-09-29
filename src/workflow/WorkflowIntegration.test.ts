import type { AssembledPrompt, PromptIntent, TeachingStrategy } from '../ai/prompts/types';
import type { KnowledgeRetrievalRequest, KnowledgeRetrievalResult } from '../knowledge/types';
import type { LLMResponse, RuntimeDecisionPacket } from '../llm/types';
import type { ValidationOutcome } from '../validator/types';
import { MentorWorkflow } from './MentorWorkflow';
import { createWorkflowDependencies, NoopWorkflowEventPort, NoopWorkflowPersistence, NoopProgressUpdatePort } from './WorkflowCoordinator';
import type { EducationalValidatorPort, KnowledgeRetrievalPort, LLMExecutionPort, WorkflowDependencies } from './WorkflowTypes';

function prompt(): AssembledPrompt {
  return { prompt: 'assembled mentor prompt', fragments: [], estimatedTokens: 10, omittedModules: [], warnings: [] };
}

export class FakeKnowledgeRetrieval implements KnowledgeRetrievalPort {
  async retrieve(request: KnowledgeRetrievalRequest): Promise<KnowledgeRetrievalResult> {
    return {
      intent: request.intent,
      teachingStrategy: request.teachingStrategy,
      query: request.normalizedMessage ?? request.userMessage,
      items: [{ id: 'pattern-1', kind: 'pattern', title: 'Definitions pattern', content: 'Pattern guidance', metadata: {}, score: 1, reasons: ['test'], tokenEstimate: 8 }],
      omitted: [],
      tokenBudget: 2200,
      usedTokens: 8,
      warnings: [],
    };
  }
}

export class FakeLLMExecution implements LLMExecutionPort {
  async execute(packet: RuntimeDecisionPacket): Promise<LLMResponse> {
    return {
      requestId: packet.requestId,
      interactionId: packet.interactionId,
      text: 'Learning objective: review definitions drafting. Next action: revise one definition clause.',
      model: 'fake-model',
      prompt: prompt(),
      toolCalls: [],
      usage: { inputTokens: 10, outputTokens: 12, totalTokens: 22, systemPromptTokens: 4, knowledgeTokens: 8, studentContextTokens: 2, draftTokens: 0 },
      cost: { model: 'fake-model', inputCostUsd: 0, outputCostUsd: 0, estimatedCostUsd: 0, completionLength: 76 },
      telemetry: {
        requestId: packet.requestId,
        interactionId: packet.interactionId,
        studentId: packet.studentId,
        intent: packet.intent,
        teachingStrategy: packet.teachingStrategy,
        promptVersion: 'test',
        model: 'fake-model',
        latencyMs: 1,
        retryCount: 0,
        cacheHit: false,
        toolCalls: [],
        usage: { inputTokens: 10, outputTokens: 12, totalTokens: 22, systemPromptTokens: 4, knowledgeTokens: 8, studentContextTokens: 2, draftTokens: 0 },
        cost: { model: 'fake-model', inputCostUsd: 0, outputCostUsd: 0, estimatedCostUsd: 0, completionLength: 76 },
      },
      raw: {},
    };
  }
}

export class FakeEducationalValidator implements EducationalValidatorPort {
  approve(packet: RuntimeDecisionPacket, response: LLMResponse): ValidationOutcome {
    return {
      action: 'approve',
      approved: true,
      response,
      violations: [],
      ruleResults: [],
      telemetry: {
        requestId: packet.requestId,
        interactionId: packet.interactionId,
        studentId: packet.studentId,
        validationTimeMs: 1,
        rulesExecuted: [],
        violations: [],
        repairActions: [],
        regenerationRequested: false,
        approved: true,
        action: 'approve',
      },
    };
  }
}

export function buildExampleWorkflow(): { workflow: MentorWorkflow; persistence: NoopWorkflowPersistence; events: NoopWorkflowEventPort; progress: NoopProgressUpdatePort } {
  const persistence = new NoopWorkflowPersistence();
  const events = new NoopWorkflowEventPort();
  const progress = new NoopProgressUpdatePort();
  const dependencies = createWorkflowDependencies({
    knowledgeRetrieval: new FakeKnowledgeRetrieval(),
    llm: new FakeLLMExecution(),
    validator: new FakeEducationalValidator(),
    persistence,
    events,
    progress,
    promptAssembly: { async assemble() { return { version: 'test-prompt', estimatedTokens: 10, warnings: [] }; } },
  });
  return { workflow: new MentorWorkflow({ dependencies }), persistence, events, progress };
}

export async function exampleMentorWorkflowExecution() {
  const { workflow } = buildExampleWorkflow();
  return workflow.execute({
    user: { id: 'student-1', roles: ['student'] },
    body: {
      message: 'Teach me how to improve my definitions clause.',
      moduleId: 'definitions-module',
      lessonId: 'definitions-lesson',
      studentLevel: 'beginner',
    },
  });
}

export async function testMentorWorkflowExecutesEndToEnd(): Promise<void> {
  const result = await exampleMentorWorkflowExecution();
  if (!result.ok) throw new Error(`Workflow failed: ${result.error?.message}`);
  if (result.state !== 'COMPLETED') throw new Error(`Unexpected state: ${result.state}`);
  if (result.packet?.intent !== 'learning') throw new Error(`Unexpected intent: ${result.packet?.intent}`);
  if (!result.responseText?.includes('Next action')) throw new Error('Validated response was not returned.');
}

export async function testMentorWorkflowPersistsAndDispatchesEvents(): Promise<void> {
  const { workflow, persistence, events } = buildExampleWorkflow();
  const result = await workflow.execute({
    user: { id: 'student-2', roles: ['student'] },
    body: { message: 'Review my draft', draftText: 'Draft provision text', componentType: 'definitions', studentLevel: 'developing' },
  });
  if (!result.ok) throw new Error('Workflow should complete.');
  if (persistence.interactions.length !== 1) throw new Error('Interaction was not persisted.');
  if (!events.events.some((event) => event.name === 'ResponseGenerated')) throw new Error('ResponseGenerated event missing.');
  if (result.packet?.intent !== 'review') throw new Error(`Expected review intent, got ${result.packet?.intent}`);
}

export type ExampleIntent = PromptIntent;
export type ExampleStrategy = TeachingStrategy;



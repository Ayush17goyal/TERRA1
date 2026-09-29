import { WorkflowCoordinator, createWorkflowDependencies } from './WorkflowCoordinator';
import type { MentorWorkflowRequest, WorkflowDependencies, WorkflowExecutionResult, WorkflowStreamEvent } from './WorkflowTypes';

export interface MentorWorkflowOptions {
  dependencies: WorkflowDependencies;
}

/**
 * End-to-end Bare Act Drafting Mentor workflow.
 *
 * Diagram:
 * Student Request
 *   -> Authenticate user
 *   -> Load student profile, curriculum, lesson, mastery, weaknesses
 *   -> Detect uploaded documents and index them through DocumentPipeline
 *   -> Normalize request and detect drafting artifacts / assessment mode
 *   -> Build RuntimeDecisionPacket
 *   -> Runtime AI Orchestrator
 *   -> Knowledge Retrieval Engine
 *   -> Prompt Assembly preflight
 *   -> LLM Service
 *   -> Educational Response Validator
 *   -> Transaction: persist interaction + update mastery + update weaknesses + schedule revision
 *   -> Background events
 *   -> Response or SSE stream + execution metadata
 */
export class MentorWorkflow {
  private readonly coordinator: WorkflowCoordinator;

  constructor(options: MentorWorkflowOptions) {
    this.coordinator = new WorkflowCoordinator({ dependencies: options.dependencies });
  }

  execute(request: MentorWorkflowRequest): Promise<WorkflowExecutionResult> {
    return this.coordinator.execute(request);
  }

  stream(request: MentorWorkflowRequest): AsyncGenerator<WorkflowStreamEvent> {
    return this.coordinator.stream(request);
  }

  static withDefaults(overrides: Partial<WorkflowDependencies> & Pick<WorkflowDependencies, 'knowledgeRetrieval' | 'llm' | 'validator'>): MentorWorkflow {
    return new MentorWorkflow({ dependencies: createWorkflowDependencies(overrides) });
  }
}

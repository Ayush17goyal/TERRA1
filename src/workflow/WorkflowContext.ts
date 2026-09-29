import type {
  AssessmentModeDetection,
  CurriculumState,
  DraftingArtifact,
  LessonState,
  MasteryState,
  MentorWorkflowRequest,
  NormalizedWorkflowRequest,
  StageTiming,
  StudentProfile,
  WeaknessState,
  WorkflowExecutionMetadata,
  WorkflowPartialFailure,
  WorkflowSnapshot,
  WorkflowState,
  WorkflowUser,
} from './WorkflowTypes';
import type { DocumentPipelineResult } from '../documents/types';

export class WorkflowContext {
  readonly request: MentorWorkflowRequest;
  readonly requestId: string;
  readonly correlationId: string;
  readonly interactionId: string;
  readonly startedAt = Date.now();
  readonly partialFailures: WorkflowPartialFailure[] = [];
  private stateValue: WorkflowState = 'PENDING';

  user?: WorkflowUser;
  profile?: StudentProfile;
  curriculum?: CurriculumState;
  lesson?: LessonState;
  mastery?: MasteryState;
  weaknesses?: WeaknessState;
  normalized?: NormalizedWorkflowRequest;
  artifacts: DraftingArtifact[] = [];
  assessment?: AssessmentModeDetection;
  documents: DocumentPipelineResult[] = [];
  retryCount = 0;

  constructor(request: MentorWorkflowRequest) {
    this.request = request;
    this.requestId = request.requestId ?? crypto.randomUUID();
    this.correlationId = request.correlationId ?? this.requestId;
    this.interactionId = request.interactionId ?? crypto.randomUUID();
  }

  get state(): WorkflowState {
    return this.stateValue;
  }

  setState(state: WorkflowState): void {
    this.stateValue = state;
  }

  addPartialFailure(stage: WorkflowPartialFailure['stage'], error: unknown, recoverable = true): void {
    this.partialFailures.push({
      stage,
      message: error instanceof Error ? error.message : String(error),
      recoverable,
      occurredAt: new Date().toISOString(),
    });
  }

  snapshot(): WorkflowSnapshot {
    if (!this.user || !this.profile || !this.curriculum || !this.lesson || !this.mastery || !this.weaknesses || !this.normalized || !this.assessment) {
      throw new Error('Workflow context snapshot requested before required state was loaded.');
    }
    return {
      requestId: this.requestId,
      correlationId: this.correlationId,
      interactionId: this.interactionId,
      user: this.user,
      profile: this.profile,
      curriculum: this.curriculum,
      lesson: this.lesson,
      mastery: this.mastery,
      weaknesses: this.weaknesses,
      normalized: this.normalized,
      artifacts: [...this.artifacts],
      assessment: this.assessment,
      documents: [...this.documents],
    };
  }

  metadata(timings: StageTiming[], retryCount = this.retryCount): WorkflowExecutionMetadata {
    return {
      requestId: this.requestId,
      correlationId: this.correlationId,
      interactionId: this.interactionId,
      state: this.state,
      intent: this.normalized?.intent,
      teachingStrategy: this.normalized?.teachingStrategy,
      startedAt: new Date(this.startedAt).toISOString(),
      completedAt: this.state === 'COMPLETED' || this.state === 'FAILED' || this.state === 'CANCELLED' ? new Date().toISOString() : undefined,
      durationMs: Date.now() - this.startedAt,
      timings,
      retryCount,
      partialFailures: [...this.partialFailures],
      documentCount: this.documents.length,
    };
  }
}

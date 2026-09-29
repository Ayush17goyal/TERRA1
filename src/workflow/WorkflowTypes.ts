import type { PromptIntent, StudentLevel, TeachingStrategy } from '../ai/prompts/types';
import type { KnowledgeRetrievalRequest, KnowledgeRetrievalResult } from '../knowledge/types';
import type { LLMResponse, LLMStreamEvent, RuntimeDecisionPacket } from '../llm/types';
import type { ValidationOutcome, ValidationViolation } from '../validator/types';
import type { UploadedDocumentInput, DocumentPipelineResult } from '../documents/types';
import type { MentorEventName } from '../jobs/types';

export type WorkflowState =
  | 'PENDING'
  | 'RUNNING'
  | 'WAITING_FOR_LLM'
  | 'VALIDATING'
  | 'UPDATING_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type WorkflowMode = 'return' | 'stream';

export interface WorkflowUser {
  id: string;
  email?: string;
  roles: string[];
  accessToken?: string;
}

export interface StudentProfile {
  id: string;
  email?: string;
  displayName?: string;
  level: StudentLevel;
  roles: string[];
  activeCourseId?: string;
  createdAt?: string;
}

export interface CurriculumState {
  courseId?: string;
  moduleId?: string;
  moduleTitle?: string;
  lessonId?: string;
  lessonTitle?: string;
  learningOutcomes?: string[];
  prerequisites?: string[];
  masteryCriteria?: string[];
  nextModule?: string;
  blockingGaps?: string[];
}

export interface LessonState {
  lessonId?: string;
  moduleId?: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'locked';
  attempts: number;
  lastActivityAt?: string;
}

export interface MasteryState {
  masteredSkills: string[];
  developingSkills: string[];
  confidenceEstimate: 'low' | 'developing' | 'functional' | 'strong' | 'mastery';
  shouldUnlockNextLesson?: boolean;
}

export interface WeaknessState {
  knownWeaknesses: string[];
  repeatedMistakes: string[];
  revisionNeeded: boolean;
  stuckStatus: boolean;
}

export interface DraftingArtifact {
  kind: 'draft_text' | 'revision' | 'capstone' | 'bare_act_excerpt' | 'uploaded_document';
  text?: string;
  componentType?: string;
  documentId?: string;
  confidence: number;
}

export interface AssessmentModeDetection {
  active: boolean;
  kind?: 'quiz' | 'assessment' | 'capstone';
  restrictions: string[];
}

export interface NormalizedWorkflowRequest {
  message: string;
  normalizedMessage: string;
  intent: PromptIntent;
  teachingStrategy: TeachingStrategy;
  studentLevel: StudentLevel;
  jurisdiction?: string;
  moduleId?: string;
  lessonId?: string;
  projectId?: string;
  sessionId?: string;
  patternNames?: string[];
  componentTypes?: string[];
  draftText?: string;
  draftObjective?: string;
  previousFeedback?: string;
  bareActTitle?: string;
  bareActExcerpt?: string;
  analysisFocus?: string;
  actStructure?: string;
  completedComponents?: string[];
  pendingComponents?: string[];
}

export interface MentorWorkflowRequest {
  requestId?: string;
  correlationId?: string;
  interactionId?: string;
  mode?: WorkflowMode;
  authToken?: string;
  user?: WorkflowUser;
  path?: string;
  method?: string;
  body: Record<string, unknown>;
  uploadedDocuments?: UploadedDocumentInput[];
  abortSignal?: AbortSignal;
  timeoutMs?: number;
  retry?: WorkflowRetryOptions;
  metadata?: Record<string, unknown>;
}

export interface WorkflowRetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStages?: WorkflowStageName[];
}

export type WorkflowStageName =
  | 'authenticate'
  | 'load_student_profile'
  | 'load_curriculum_state'
  | 'load_lesson_state'
  | 'load_mastery'
  | 'load_weaknesses'
  | 'process_documents'
  | 'decision'
  | 'runtime_orchestration'
  | 'knowledge_retrieval'
  | 'prompt_assembly'
  | 'llm'
  | 'validation'
  | 'persistence'
  | 'progress_update'
  | 'events'
  | 'telemetry';

export interface StageTiming {
  stage: WorkflowStageName;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  success: boolean;
  errorCode?: string;
}

export interface WorkflowExecutionMetadata {
  requestId: string;
  correlationId: string;
  interactionId: string;
  state: WorkflowState;
  intent?: PromptIntent;
  teachingStrategy?: TeachingStrategy;
  startedAt: string;
  completedAt?: string;
  durationMs: number;
  timings: StageTiming[];
  retryCount: number;
  partialFailures: WorkflowPartialFailure[];
  documentCount: number;
  retrievalTokens?: number;
  validationAction?: ValidationOutcome['action'];
}

export interface WorkflowPartialFailure {
  stage: WorkflowStageName;
  message: string;
  recoverable: boolean;
  occurredAt: string;
}

export interface WorkflowExecutionResult {
  ok: boolean;
  state: WorkflowState;
  requestId: string;
  correlationId: string;
  interactionId: string;
  responseText?: string;
  packet?: RuntimeDecisionPacket;
  retrieval?: KnowledgeRetrievalResult;
  llm?: LLMResponse;
  validation?: ValidationOutcome;
  documents: DocumentPipelineResult[];
  metadata: WorkflowExecutionMetadata;
  error?: WorkflowErrorPayload;
}

export interface WorkflowStreamEvent {
  event: 'state' | 'text' | 'tool' | 'validation' | 'completion' | 'error' | 'cancelled';
  requestId: string;
  correlationId: string;
  interactionId: string;
  data: unknown;
}

export interface WorkflowErrorPayload {
  code: string;
  message: string;
  stage?: WorkflowStageName;
  recoverable: boolean;
  details?: unknown;
}

export interface WorkflowAuthPort {
  authenticate(request: MentorWorkflowRequest): Promise<WorkflowUser>;
}

export interface StudentStatePort {
  loadStudentProfile(user: WorkflowUser, request: MentorWorkflowRequest): Promise<StudentProfile>;
  loadCurriculumState(profile: StudentProfile, request: MentorWorkflowRequest): Promise<CurriculumState>;
  loadLessonState(profile: StudentProfile, curriculum: CurriculumState, request: MentorWorkflowRequest): Promise<LessonState>;
  loadMastery(profile: StudentProfile, curriculum: CurriculumState, request: MentorWorkflowRequest): Promise<MasteryState>;
  loadWeaknesses(profile: StudentProfile, curriculum: CurriculumState, request: MentorWorkflowRequest): Promise<WeaknessState>;
}

export interface RuntimeOrchestratorPort {
  run(packet: RuntimeDecisionPacket, context: WorkflowSnapshot): Promise<RuntimeDecisionPacket>;
}

export interface KnowledgeRetrievalPort {
  retrieve(request: KnowledgeRetrievalRequest): Promise<KnowledgeRetrievalResult>;
}

export interface PromptAssemblyPort {
  assemble(packet: RuntimeDecisionPacket): Promise<{ version?: string; estimatedTokens?: number; warnings?: string[] }>;
}

export interface LLMExecutionPort {
  execute(packet: RuntimeDecisionPacket): Promise<LLMResponse>;
  stream?(packet: RuntimeDecisionPacket): AsyncGenerator<LLMStreamEvent>;
}

export interface EducationalValidatorPort {
  approve(packet: RuntimeDecisionPacket, response: LLMResponse): ValidationOutcome;
  regenerate?(packet: RuntimeDecisionPacket, response: LLMResponse, violations?: ValidationViolation[]): Promise<unknown>;
}

export interface WorkflowPersistencePort {
  transaction<T>(operation: () => Promise<T>): Promise<T>;
  persistInteraction(record: WorkflowInteractionRecord): Promise<void>;
}

export interface ProgressUpdatePort {
  updateMastery(record: WorkflowProgressRecord): Promise<void>;
  updateWeaknesses(record: WorkflowProgressRecord): Promise<void>;
  scheduleRevision(record: WorkflowProgressRecord): Promise<void>;
}

export interface DocumentProcessingPort {
  process(input: UploadedDocumentInput): Promise<DocumentPipelineResult>;
}

export interface WorkflowEventPort {
  emit(event: {
    name: MentorEventName;
    payload: Record<string, unknown>;
    correlationId: string;
    studentId?: string;
    interactionId: string;
  }): Promise<unknown>;
}

export interface WorkflowLoggerPort {
  info(data: unknown, message?: string): void;
  warn(data: unknown, message?: string): void;
  error(data: unknown, message?: string): void;
  debug?(data: unknown, message?: string): void;
}

export interface WorkflowTelemetryPort {
  startSpan(name: string, attributes?: Record<string, unknown>): WorkflowTelemetrySpan;
  recordMetric(name: string, value: number, attributes?: Record<string, unknown>): void;
}

export interface WorkflowTelemetrySpan {
  setAttribute(name: string, value: unknown): void;
  recordException(error: Error): void;
  end(): void;
}

export interface WorkflowInteractionRecord {
  requestId: string;
  correlationId: string;
  interactionId: string;
  studentId: string;
  intent: PromptIntent;
  teachingStrategy: TeachingStrategy;
  request: NormalizedWorkflowRequest;
  responseText: string;
  validation: ValidationOutcome['telemetry'];
  llmTelemetry?: LLMResponse['telemetry'];
  retrieval?: Pick<KnowledgeRetrievalResult, 'usedTokens' | 'tokenBudget' | 'warnings'>;
  documents: Array<{ documentId: string; documentType: string; duplicate: boolean }>;
  createdAt: string;
}

export interface WorkflowProgressRecord {
  requestId: string;
  correlationId: string;
  interactionId: string;
  studentId: string;
  curriculum: CurriculumState;
  lesson: LessonState;
  mastery: MasteryState;
  weaknesses: WeaknessState;
  intent: PromptIntent;
  validation?: ValidationOutcome;
  llm?: LLMResponse;
  occurredAt: string;
}

export interface WorkflowSnapshot {
  requestId: string;
  correlationId: string;
  interactionId: string;
  user: WorkflowUser;
  profile: StudentProfile;
  curriculum: CurriculumState;
  lesson: LessonState;
  mastery: MasteryState;
  weaknesses: WeaknessState;
  normalized: NormalizedWorkflowRequest;
  artifacts: DraftingArtifact[];
  assessment: AssessmentModeDetection;
  documents: DocumentPipelineResult[];
}

export interface WorkflowDependencies {
  auth: WorkflowAuthPort;
  studentState: StudentStatePort;
  runtimeOrchestrator: RuntimeOrchestratorPort;
  knowledgeRetrieval: KnowledgeRetrievalPort;
  promptAssembly: PromptAssemblyPort;
  llm: LLMExecutionPort;
  validator: EducationalValidatorPort;
  persistence: WorkflowPersistencePort;
  progress: ProgressUpdatePort;
  documents?: DocumentProcessingPort;
  events?: WorkflowEventPort;
  telemetry?: WorkflowTelemetryPort;
  logger?: WorkflowLoggerPort;
}

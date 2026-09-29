export type JobQueueName =
  | 'EmbeddingQueue'
  | 'DocumentIndexQueue'
  | 'KnowledgeRefreshQueue'
  | 'MasteryUpdateQueue'
  | 'WeaknessAnalysisQueue'
  | 'RevisionSchedulingQueue'
  | 'PromptLogQueue'
  | 'TelemetryQueue'
  | 'AnalyticsQueue'
  | 'CacheInvalidationQueue'
  | 'NotificationQueue';

export type MentorEventName =
  | 'StudentMessageReceived'
  | 'ResponseGenerated'
  | 'ResponseValidated'
  | 'LessonCompleted'
  | 'SkillMastered'
  | 'WeaknessDetected'
  | 'DraftSubmitted'
  | 'DraftReviewed'
  | 'RevisionSubmitted'
  | 'AssessmentCompleted'
  | 'QuizCompleted'
  | 'CapstoneReviewed'
  | 'DocumentUploaded'
  | 'BareActIndexed'
  | 'EmbeddingsGenerated'
  | 'KnowledgeUpdated'
  | 'PromptExecuted'
  | 'TelemetryRecorded';

export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'dead_lettered';

export interface MentorEvent<TPayload = Record<string, unknown>> {
  id: string;
  name: MentorEventName;
  payload: TPayload;
  occurredAt: string;
  correlationId?: string;
  studentId?: string;
  interactionId?: string;
}

export interface JobEnvelope<TPayload = Record<string, unknown>> {
  id: string;
  name: string;
  queueName: JobQueueName;
  payload: TPayload;
  attemptsMade: number;
  maxAttempts: number;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  correlationId?: string;
}

export interface JobOptions {
  jobId?: string;
  attempts?: number;
  delayMs?: number;
  priority?: number;
  removeOnComplete?: boolean;
  backoff?: RetryPolicy;
}

export interface RetryPolicy {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
}

export interface JobQueue<TPayload = Record<string, unknown>> {
  readonly name: JobQueueName;
  add(name: string, payload: TPayload, options?: JobOptions): Promise<JobEnvelope<TPayload>>;
  getDepth(): Promise<number>;
  drain(): Promise<void>;
}

export interface JobProcessor<TPayload = Record<string, unknown>> {
  readonly name: string;
  process(job: JobEnvelope<TPayload>): Promise<void>;
}

export interface WorkerRuntime {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface JobFailureRecord {
  job: JobEnvelope;
  error: string;
  failedAt: string;
  nextRetryAt?: string;
}

export interface QueueTelemetryRecord {
  queueName: JobQueueName;
  workerName?: string;
  queueDepth?: number;
  workerDurationMs?: number;
  failureRate?: number;
  retryCount?: number;
  throughput?: number;
  averageExecutionTimeMs?: number;
  eventLatencyMs?: number;
}

export interface SupabaseJobStore {
  insert(table: string, record: Record<string, unknown>): Promise<void>;
  update?(table: string, id: string, patch: Record<string, unknown>): Promise<void>;
  selectDue?(table: string, nowIso: string): Promise<Array<Record<string, unknown>>>;
}

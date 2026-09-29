import type { RuntimeDecisionPacket, LLMResponse, LLMStreamEvent } from '../llm/types';
import type { ValidationOutcome } from '../validator/types';
import type { KnowledgeRetrievalResult } from '../knowledge/types';
import type { WorkflowContext } from './WorkflowContext';
import type { DecisionPipeline } from './DecisionPipeline';
import type {
  WorkflowDependencies,
  WorkflowExecutionResult,
  WorkflowProgressRecord,
  WorkflowRetryOptions,
  WorkflowStageName,
  WorkflowStreamEvent,
} from './WorkflowTypes';
import { WorkflowCancelledError, WorkflowError, WorkflowTimeoutError, toWorkflowError } from './WorkflowErrors';
import { WorkflowTelemetry } from './WorkflowTelemetry';

export interface ExecutionPipelineOptions {
  dependencies: WorkflowDependencies;
  decisionPipeline: DecisionPipeline;
  telemetry: WorkflowTelemetry;
}

export class ExecutionPipeline {
  private readonly dependencies: WorkflowDependencies;
  private readonly decisionPipeline: DecisionPipeline;
  private readonly telemetry: WorkflowTelemetry;

  constructor(options: ExecutionPipelineOptions) {
    this.dependencies = options.dependencies;
    this.decisionPipeline = options.decisionPipeline;
    this.telemetry = options.telemetry;
  }

  async execute(context: WorkflowContext): Promise<WorkflowExecutionResult> {
    let packet: RuntimeDecisionPacket | undefined;
    let retrieval: KnowledgeRetrievalResult | undefined;
    let llm: LLMResponse | undefined;
    let validation: ValidationOutcome | undefined;

    try {
      this.setState(context, 'RUNNING');
      await this.emit(context, 'StudentMessageReceived', { path: context.request.path, mode: context.request.mode ?? 'return' });

      await this.loadContext(context);
      await this.telemetry.time('process_documents', () => this.decisionPipeline.prepareContext(context));

      const snapshot = context.snapshot();
      packet = await this.telemetry.time('decision', async () => this.decisionPipeline.buildRuntimePacket(snapshot));
      packet.abortSignal = context.request.abortSignal;

      packet = await this.withRetry(context, 'runtime_orchestration', () => this.decisionPipeline.runRuntimeOrchestrator(packet as RuntimeDecisionPacket, snapshot));
      retrieval = await this.withRetry(context, 'knowledge_retrieval', () => this.dependencies.knowledgeRetrieval.retrieve(this.decisionPipeline.buildKnowledgeRequest(snapshot)));
      packet = { ...packet, retrieval };

      await this.withPartialFailure(context, 'prompt_assembly', () => this.dependencies.promptAssembly.assemble(packet as RuntimeDecisionPacket));

      this.setState(context, 'WAITING_FOR_LLM');
      llm = await this.withRetry(context, 'llm', () => this.dependencies.llm.execute(packet as RuntimeDecisionPacket));
      await this.emit(context, 'PromptExecuted', { intent: packet.intent, strategy: packet.teachingStrategy, model: llm.model });

      this.setState(context, 'VALIDATING');
      validation = await this.telemetry.time('validation', async () => this.dependencies.validator.approve(packet as RuntimeDecisionPacket, llm as LLMResponse));
      await this.emit(context, 'ResponseValidated', { action: validation.action, violations: validation.violations });

      if (validation.action === 'block_response') {
        throw new WorkflowError('RESPONSE_BLOCKED', 'The AI response violated educational safety policy.', {
          stage: 'validation',
          recoverable: false,
          details: validation.violations,
        });
      }
      if (validation.action === 'request_regeneration') {
        await this.dependencies.validator.regenerate?.(packet, llm, validation.violations);
        throw new WorkflowError('REGENERATION_REQUIRED', 'The AI response requires regeneration before delivery.', {
          stage: 'validation',
          recoverable: true,
          details: validation.violations,
        });
      }

      this.setState(context, 'UPDATING_PROGRESS');
      await this.persistAndUpdate(context, packet, retrieval, llm, validation);
      await this.dispatchCompletionEvents(context, packet, validation);

      this.setState(context, 'COMPLETED');
      const metadata = {
        ...context.metadata(this.telemetry.getTimings()),
        retrievalTokens: retrieval.usedTokens,
        validationAction: validation.action,
      };
      return {
        ok: true,
        state: 'COMPLETED',
        requestId: context.requestId,
        correlationId: context.correlationId,
        interactionId: context.interactionId,
        responseText: validation.response.text,
        packet,
        retrieval,
        llm,
        validation,
        documents: context.documents,
        metadata,
      };
    } catch (error) {
      const workflowError = error instanceof WorkflowCancelledError ? error : toWorkflowError(error);
      this.setState(context, workflowError instanceof WorkflowCancelledError ? 'CANCELLED' : 'FAILED');
      this.dependencies.logger?.error({ error: workflowError.toPayload(), requestId: context.requestId }, 'mentor workflow failed');
      return {
        ok: false,
        state: context.state,
        requestId: context.requestId,
        correlationId: context.correlationId,
        interactionId: context.interactionId,
        packet,
        retrieval,
        llm,
        validation,
        documents: context.documents,
        metadata: context.metadata(this.telemetry.getTimings()),
        error: workflowError.toPayload(),
      };
    }
  }

  async *stream(context: WorkflowContext): AsyncGenerator<WorkflowStreamEvent> {
    let packet: RuntimeDecisionPacket | undefined;
    let finalResponse: LLMResponse | undefined;
    try {
      this.setState(context, 'RUNNING');
      yield this.stateEvent(context);
      await this.emit(context, 'StudentMessageReceived', { path: context.request.path, mode: 'stream' });
      await this.loadContext(context);
      await this.telemetry.time('process_documents', () => this.decisionPipeline.prepareContext(context));

      const snapshot = context.snapshot();
      packet = this.decisionPipeline.buildRuntimePacket(snapshot);
      packet.abortSignal = context.request.abortSignal;
      packet = await this.withRetry(context, 'runtime_orchestration', () => this.decisionPipeline.runRuntimeOrchestrator(packet as RuntimeDecisionPacket, snapshot));
      const retrieval = await this.withRetry(context, 'knowledge_retrieval', () => this.dependencies.knowledgeRetrieval.retrieve(this.decisionPipeline.buildKnowledgeRequest(snapshot)));
      packet = { ...packet, retrieval };
      await this.withPartialFailure(context, 'prompt_assembly', () => this.dependencies.promptAssembly.assemble(packet as RuntimeDecisionPacket));

      if (!this.dependencies.llm.stream) {
        const result = await this.execute(context);
        yield { event: result.ok ? 'completion' : 'error', requestId: context.requestId, correlationId: context.correlationId, interactionId: context.interactionId, data: result };
        return;
      }

      this.setState(context, 'WAITING_FOR_LLM');
      yield this.stateEvent(context);
      for await (const event of this.dependencies.llm.stream(packet)) {
        this.throwIfCancelled(context, 'llm');
        const mapped = this.mapStreamEvent(context, event);
        if (mapped) yield mapped;
        if (event.type === 'completion' && event.response) finalResponse = event.response;
      }

      if (!finalResponse) throw new WorkflowError('STREAM_COMPLETION_MISSING', 'The LLM stream ended without a completion response.', { stage: 'llm', recoverable: true });

      this.setState(context, 'VALIDATING');
      yield this.stateEvent(context);
      const validation = this.dependencies.validator.approve(packet, finalResponse);
      yield { event: 'validation', requestId: context.requestId, correlationId: context.correlationId, interactionId: context.interactionId, data: { action: validation.action, violations: validation.violations } };
      if (validation.action !== 'approve') {
        throw new WorkflowError(validation.action === 'block_response' ? 'RESPONSE_BLOCKED' : 'REGENERATION_REQUIRED', 'The streamed AI response did not pass educational validation.', {
          stage: 'validation',
          recoverable: validation.action !== 'block_response',
          details: validation.violations,
        });
      }

      this.setState(context, 'UPDATING_PROGRESS');
      await this.persistAndUpdate(context, packet, packet.retrieval as KnowledgeRetrievalResult, finalResponse, validation);
      await this.dispatchCompletionEvents(context, packet, validation);
      this.setState(context, 'COMPLETED');
      yield { event: 'completion', requestId: context.requestId, correlationId: context.correlationId, interactionId: context.interactionId, data: { text: validation.response.text, metadata: context.metadata(this.telemetry.getTimings()) } };
    } catch (error) {
      const workflowError = error instanceof WorkflowCancelledError ? error : toWorkflowError(error);
      this.setState(context, workflowError instanceof WorkflowCancelledError ? 'CANCELLED' : 'FAILED');
      yield { event: workflowError instanceof WorkflowCancelledError ? 'cancelled' : 'error', requestId: context.requestId, correlationId: context.correlationId, interactionId: context.interactionId, data: workflowError.toPayload() };
    }
  }

  private async loadContext(context: WorkflowContext): Promise<void> {
    context.user = await this.withRetry(context, 'authenticate', () => this.dependencies.auth.authenticate(context.request));
    context.profile = await this.withRetry(context, 'load_student_profile', () => this.dependencies.studentState.loadStudentProfile(context.user as NonNullable<typeof context.user>, context.request));
    context.curriculum = await this.withRetry(context, 'load_curriculum_state', () => this.dependencies.studentState.loadCurriculumState(context.profile as NonNullable<typeof context.profile>, context.request));
    context.lesson = await this.withRetry(context, 'load_lesson_state', () => this.dependencies.studentState.loadLessonState(context.profile as NonNullable<typeof context.profile>, context.curriculum as NonNullable<typeof context.curriculum>, context.request));
    context.mastery = await this.withRetry(context, 'load_mastery', () => this.dependencies.studentState.loadMastery(context.profile as NonNullable<typeof context.profile>, context.curriculum as NonNullable<typeof context.curriculum>, context.request));
    context.weaknesses = await this.withRetry(context, 'load_weaknesses', () => this.dependencies.studentState.loadWeaknesses(context.profile as NonNullable<typeof context.profile>, context.curriculum as NonNullable<typeof context.curriculum>, context.request));
  }

  private async persistAndUpdate(context: WorkflowContext, packet: RuntimeDecisionPacket, retrieval: KnowledgeRetrievalResult, llm: LLMResponse, validation: ValidationOutcome): Promise<void> {
    await this.dependencies.persistence.transaction(async () => {
      await this.telemetry.time('persistence', () => this.dependencies.persistence.persistInteraction({
        requestId: context.requestId,
        correlationId: context.correlationId,
        interactionId: context.interactionId,
        studentId: packet.studentId as string,
        intent: packet.intent,
        teachingStrategy: packet.teachingStrategy,
        request: context.normalized as NonNullable<typeof context.normalized>,
        responseText: validation.response.text,
        validation: validation.telemetry,
        llmTelemetry: llm.telemetry,
        retrieval: { usedTokens: retrieval.usedTokens, tokenBudget: retrieval.tokenBudget, warnings: retrieval.warnings },
        documents: context.documents.map((result) => ({ documentId: result.document.id, documentType: result.document.documentType, duplicate: result.duplicate })),
        createdAt: new Date().toISOString(),
      }));

      const record: WorkflowProgressRecord = {
        requestId: context.requestId,
        correlationId: context.correlationId,
        interactionId: context.interactionId,
        studentId: packet.studentId as string,
        curriculum: context.curriculum as NonNullable<typeof context.curriculum>,
        lesson: context.lesson as NonNullable<typeof context.lesson>,
        mastery: context.mastery as NonNullable<typeof context.mastery>,
        weaknesses: context.weaknesses as NonNullable<typeof context.weaknesses>,
        intent: packet.intent,
        validation,
        llm,
        occurredAt: new Date().toISOString(),
      };

      await this.telemetry.time('progress_update', async () => {
        await this.dependencies.progress.updateMastery(record);
        await this.dependencies.progress.updateWeaknesses(record);
        if (record.weaknesses.revisionNeeded || packet.intent === 'revision' || packet.intent === 'review') {
          await this.dependencies.progress.scheduleRevision(record);
        }
      });
    });
  }

  private async dispatchCompletionEvents(context: WorkflowContext, packet: RuntimeDecisionPacket, validation: ValidationOutcome): Promise<void> {
    await this.withPartialFailure(context, 'events', async () => {
      await this.emit(context, 'ResponseGenerated', { intent: packet.intent, strategy: packet.teachingStrategy });
      if (packet.intent === 'review') await this.emit(context, 'DraftReviewed', { validationAction: validation.action });
      if (packet.intent === 'revision') await this.emit(context, 'RevisionSubmitted', { validationAction: validation.action });
      if (packet.intent === 'quiz') await this.emit(context, 'QuizCompleted', { validationAction: validation.action });
      if (packet.intent === 'assessment') await this.emit(context, 'AssessmentCompleted', { validationAction: validation.action });
      if (packet.intent === 'capstone') await this.emit(context, 'CapstoneReviewed', { validationAction: validation.action });
      for (const document of context.documents) await this.emit(context, 'DocumentUploaded', { documentId: document.document.id, type: document.document.documentType });
      await this.emit(context, 'TelemetryRecorded', { timings: this.telemetry.getTimings().length });
    });
  }

  private async withRetry<T>(context: WorkflowContext, stage: WorkflowStageName, operation: () => Promise<T>): Promise<T> {
    const retry = context.request.retry ?? this.defaultRetry();
    const retryable = retry.retryableStages?.includes(stage) ?? this.defaultRetryable(stage);
    const attempts = retryable ? Math.max(1, retry.maxAttempts) : 1;
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        this.throwIfCancelled(context, stage);
        return await this.telemetry.time(stage, () => this.withTimeout(context, stage, operation));
      } catch (error) {
        lastError = error;
        if (error instanceof WorkflowCancelledError || attempt >= attempts) break;
        context.retryCount += 1;
        await this.delay(this.backoff(attempt, retry));
      }
    }
    throw toWorkflowError(lastError, stage);
  }

  private async withPartialFailure<T>(context: WorkflowContext, stage: WorkflowStageName, operation: () => Promise<T>): Promise<T | undefined> {
    try {
      return await this.telemetry.time(stage, operation);
    } catch (error) {
      context.addPartialFailure(stage, error, true);
      this.dependencies.logger?.warn({ requestId: context.requestId, stage, error: error instanceof Error ? error.message : String(error) }, 'mentor workflow recovered from partial failure');
      return undefined;
    }
  }

  private async withTimeout<T>(context: WorkflowContext, stage: WorkflowStageName, operation: () => Promise<T>): Promise<T> {
    const timeoutMs = context.request.timeoutMs;
    if (!timeoutMs) return operation();
    return await new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new WorkflowTimeoutError(stage, timeoutMs)), timeoutMs);
      operation().then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
    });
  }

  private mapStreamEvent(context: WorkflowContext, event: LLMStreamEvent): WorkflowStreamEvent | undefined {
    if (event.type === 'text_delta') return { event: 'text', requestId: context.requestId, correlationId: context.correlationId, interactionId: context.interactionId, data: { delta: event.delta } };
    if (event.type === 'tool_event') return { event: 'tool', requestId: context.requestId, correlationId: context.correlationId, interactionId: context.interactionId, data: { toolCall: event.toolCall } };
    if (event.type === 'error') return { event: 'error', requestId: context.requestId, correlationId: context.correlationId, interactionId: context.interactionId, data: { message: event.error?.message } };
    if (event.type === 'cancellation') return { event: 'cancelled', requestId: context.requestId, correlationId: context.correlationId, interactionId: context.interactionId, data: {} };
    return undefined;
  }

  private async emit(context: WorkflowContext, name: Parameters<NonNullable<typeof this.dependencies.events>['emit']>[0]['name'], payload: Record<string, unknown>): Promise<void> {
    await this.dependencies.events?.emit({
      name,
      payload,
      correlationId: context.correlationId,
      studentId: context.user?.id,
      interactionId: context.interactionId,
    });
  }

  private setState(context: WorkflowContext, state: typeof context.state): void {
    context.setState(state);
    this.telemetry.recordState(state);
    this.dependencies.logger?.info({ requestId: context.requestId, state }, 'mentor workflow state changed');
  }

  private stateEvent(context: WorkflowContext): WorkflowStreamEvent {
    return { event: 'state', requestId: context.requestId, correlationId: context.correlationId, interactionId: context.interactionId, data: { state: context.state } };
  }

  private throwIfCancelled(context: WorkflowContext, stage: WorkflowStageName): void {
    if (context.request.abortSignal?.aborted) throw new WorkflowCancelledError(stage);
  }

  private defaultRetry(): WorkflowRetryOptions {
    return { maxAttempts: 2, baseDelayMs: 150, maxDelayMs: 1200, retryableStages: ['knowledge_retrieval', 'runtime_orchestration', 'llm'] };
  }

  private defaultRetryable(stage: WorkflowStageName): boolean {
    return stage === 'knowledge_retrieval' || stage === 'runtime_orchestration' || stage === 'llm';
  }

  private backoff(attempt: number, retry: WorkflowRetryOptions): number {
    const exponential = Math.min(retry.maxDelayMs, retry.baseDelayMs * 2 ** (attempt - 1));
    return Math.floor(exponential * (0.75 + Math.random() * 0.5));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

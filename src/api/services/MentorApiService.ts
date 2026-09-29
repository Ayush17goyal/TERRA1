import type { KnowledgeRetrievalEngine } from '../../knowledge';
import type { BackgroundJobSystem } from '../../jobs';
import type { LLMResponse, RuntimeDecisionPacket } from '../../llm/types';
import { LLMService } from '../../llm';
import { ResponseValidator as EducationalResponseValidator } from '../../validator';
import type { ValidationOutcome } from '../../validator/types';
import { ApiError } from '../errors/ApiError';
import type { ApiPipelineResult, ApiRequestContext, PersistenceAdapter } from '../types';
import { RuntimePacketBuilder } from './RuntimePacketBuilder';
import { InMemoryPersistenceAdapter } from './ApiPersistenceService';
import { assertNotProductionDefault } from './ProductionRuntimeSafety';

export interface MentorApiServiceOptions {
  llmService?: LLMService;
  responseValidator?: EducationalResponseValidator;
  knowledgeEngine?: KnowledgeRetrievalEngine;
  persistence?: PersistenceAdapter;
  jobs?: BackgroundJobSystem;
}

export class MentorApiService {
  private readonly llmService: LLMService;
  private readonly responseValidator: EducationalResponseValidator;
  private readonly knowledgeEngine?: KnowledgeRetrievalEngine;
  private readonly persistence: PersistenceAdapter;
  private readonly jobs?: BackgroundJobSystem;
  private readonly packetBuilder = new RuntimePacketBuilder();

  constructor(options: MentorApiServiceOptions = {}) {
    assertNotProductionDefault('MentorApiService', [
      !options.llmService ? 'llmService' : '',
      !options.responseValidator ? 'responseValidator' : '',
      !options.knowledgeEngine ? 'knowledgeEngine' : '',
      !options.persistence ? 'persistence' : '',
      !options.jobs ? 'jobs' : '',
    ].filter(Boolean));
    this.llmService = options.llmService ?? new LLMService();
    this.responseValidator = options.responseValidator ?? new EducationalResponseValidator();
    this.knowledgeEngine = options.knowledgeEngine;
    this.persistence = options.persistence ?? new InMemoryPersistenceAdapter();
    this.jobs = options.jobs;
  }

  async runAI(context: ApiRequestContext, body: Parameters<RuntimePacketBuilder['build']>[1], intent: Parameters<RuntimePacketBuilder['build']>[2], strategy: Parameters<RuntimePacketBuilder['build']>[3]): Promise<ApiPipelineResult> {
    const packet = this.packetBuilder.build(context, body, intent, strategy);
    const retrieval = await this.retrieve(packet);
    const enrichedPacket: RuntimeDecisionPacket = { ...packet, retrieval };
    const llm = await this.executeLLM(enrichedPacket);
    const validation = this.responseValidator.approve(enrichedPacket, llm);

    if (validation.action === 'block_response') {
      await this.publish(context, 'ResponseValidated', { action: validation.action, violations: validation.violations });
      throw new ApiError(422, 'RESPONSE_BLOCKED', 'The AI response violated educational safety policy.', validation.violations);
    }
    if (validation.action === 'request_regeneration') {
      await this.responseValidator.regenerate(enrichedPacket, llm, validation.violations);
      throw new ApiError(409, 'REGENERATION_REQUIRED', 'The AI response requires regeneration before delivery.', validation.violations);
    }

    await this.persistence.saveInteraction({
      requestId: context.requestId,
      interactionId: context.correlationId,
      studentId: context.user?.id,
      intent,
      strategy,
      response: validation.response.text,
      validation: validation.telemetry,
      createdAt: new Date().toISOString(),
    });
    await this.publish(context, 'ResponseGenerated', { intent, strategy });
    await this.publish(context, 'ResponseValidated', { action: validation.action, violations: validation.violations });

    return { packet: enrichedPacket, retrieval, llm, validation };
  }

  async streamAI(context: ApiRequestContext, body: Parameters<RuntimePacketBuilder['build']>[1]): Promise<AsyncGenerator<{ event: string; data: unknown }>> {
    const intent = this.inferStreamingIntent(body);
    const strategy = intent === 'review' ? 'review'
      : intent === 'revision' ? 'revision_guidance'
        : intent === 'capstone' ? 'capstone_review'
          : intent === 'assessment' ? 'assessment_feedback'
            : 'teach';
    const packet = this.packetBuilder.build(context, body, intent, strategy);
    const retrieval = await this.retrieve(packet);
    const enrichedPacket: RuntimeDecisionPacket = { ...packet, retrieval };
    const stream = this.llmService.streamResponse(enrichedPacket);
    const validator = this.responseValidator;
    const publish = (event: string, data: unknown) => ({ event, data });

    async function* iterator(): AsyncGenerator<{ event: string; data: unknown }> {
      const bufferBeforeApproval = MentorApiService.requiresValidatedStreaming(enrichedPacket);
      let bufferedText = '';
      for await (const event of stream) {
        if (event.type === 'text_delta') {
          if (bufferBeforeApproval) {
            bufferedText += event.delta;
          } else {
            yield publish('text', { delta: event.delta });
          }
        }
        if (event.type === 'tool_event') yield publish('tool', { toolCall: event.toolCall });
        if (event.type === 'error') yield publish('error', { message: event.error?.message });
        if (event.type === 'cancellation') yield publish('cancellation', {});
        if (event.type === 'completion' && event.response) {
          const validation = validator.approve(enrichedPacket, event.response);
          yield publish('validation', { action: validation.action, violations: validation.violations });
          if (validation.action === 'block_response' || validation.action === 'request_regeneration') {
            yield publish('error', { message: 'The AI response was blocked by educational safety validation.', action: validation.action });
            continue;
          }
          if (bufferBeforeApproval && bufferedText) {
            yield publish('text', { delta: validation.response.text });
          }
          yield publish('completion', { text: validation.response.text, telemetry: validation.telemetry });
        }
      }
    }

    return iterator();
  }

  async completeLesson(context: ApiRequestContext, body: { courseId?: string; moduleId: string; lessonId: string; lessonTitle?: string }): Promise<void> {
    await this.persistence.saveProgress({ ...body, studentId: context.user?.id, completedAt: new Date().toISOString() });
    await this.publish(context, 'LessonCompleted', body);
  }

  async saveDocument(context: ApiRequestContext, body: Record<string, unknown>): Promise<{ documentId: string }> {
    const documentId = crypto.randomUUID();
    await this.persistence.saveDocumentUpload({ ...body, documentId, studentId: context.user?.id, uploadedAt: new Date().toISOString() });
    await this.publish(context, 'DocumentUploaded', { ...body, documentId });
    return { documentId };
  }

  getStudentResource(context: ApiRequestContext, kind: 'progress' | 'mastery' | 'projects' | 'history'): Promise<unknown> {
    if (!context.user?.id) throw new ApiError(401, 'UNAUTHENTICATED', 'Authenticated user required.');
    return this.persistence.getStudentResource(kind, context.user.id);
  }

  getKnowledgeResource(context: ApiRequestContext, kind: 'pattern' | 'lesson' | 'module', id: string): Promise<unknown> {
    return this.persistence.getKnowledgeResource(kind, id, context.user?.id);
  }

  private async retrieve(packet: RuntimeDecisionPacket) {
    if (!this.knowledgeEngine) return undefined;
    const request = {
      userId: packet.studentId,
      courseId: packet.promptRequest.curriculum?.moduleId,
      moduleId: packet.promptRequest.curriculum?.moduleId,
      lessonId: packet.promptRequest.curriculum?.lessonId,
      projectId: packet.promptRequest.capstone?.objective,
      draftId: packet.promptRequest.draft?.componentType,
      userMessage: packet.promptRequest.userMessage,
      normalizedMessage: packet.promptRequest.normalizedMessage,
      intent: packet.intent,
      teachingStrategy: packet.teachingStrategy,
      studentLevel: packet.promptRequest.student?.level ?? 'beginner',
      patternNames: packet.promptRequest.patterns?.map((pattern) => pattern.name),
      componentTypes: packet.promptRequest.draft?.componentType ? [packet.promptRequest.draft.componentType] : undefined,
      jurisdiction: packet.promptRequest.defaultJurisdiction,
    };
    if (packet.intent === 'review') return this.knowledgeEngine.retrieveForReview(request);
    if (packet.intent === 'revision') return this.knowledgeEngine.retrieveForRevision(request);
    if (packet.intent === 'quiz') return this.knowledgeEngine.retrieveForQuiz(request);
    if (packet.intent === 'assessment') return this.knowledgeEngine.retrieveForAssessment(request);
    if (packet.intent === 'capstone') return this.knowledgeEngine.retrieveForCapstone(request);
    if (packet.intent === 'bare_act_analysis') return this.knowledgeEngine.retrieveForBareActAnalysis(request);
    if (packet.intent === 'drafting') return this.knowledgeEngine.retrieveForDrafting(request);
    return this.knowledgeEngine.retrieveForLearning(request);
  }

  private async executeLLM(packet: RuntimeDecisionPacket): Promise<LLMResponse> {
    if (packet.intent === 'review') return this.llmService.generateDraftReview(packet);
    if (packet.intent === 'revision') return this.llmService.generateRevisionFeedback(packet);
    if (packet.intent === 'quiz') return this.llmService.generateQuiz(packet);
    if (packet.intent === 'assessment') return this.llmService.generateAssessmentFeedback(packet);
    if (packet.intent === 'capstone') return this.llmService.generateCapstoneReview(packet);
    if (packet.intent === 'bare_act_analysis') return this.llmService.generateBareActAnalysis(packet);
    return this.llmService.generateExplanation(packet);
  }

  private inferStreamingIntent(body: Parameters<RuntimePacketBuilder['build']>[1]): RuntimeDecisionPacket['intent'] {
    const record = body as Record<string, unknown>;
    if (typeof record.assessmentId === 'string') return 'assessment';
    if (Array.isArray(record.completedComponents) || Array.isArray(record.pendingComponents)) return 'capstone';
    if (typeof record.previousFeedback === 'string') return 'revision';
    if (typeof record.draftText === 'string') return 'review';
    if (typeof record.bareActTitle === 'string' || typeof record.excerpt === 'string') return 'bare_act_analysis';
    return 'learning';
  }

  private static requiresValidatedStreaming(packet: RuntimeDecisionPacket): boolean {
    const flags = packet.promptRequest.safety?.riskFlags ?? [];
    return ['assessment', 'capstone', 'review', 'revision', 'quiz'].includes(packet.intent)
      || flags.some((flag) => /ghostwriting|assessment|complete_bare_act|prompt_injection/i.test(flag));
  }
  private async publish(context: ApiRequestContext, name: Parameters<BackgroundJobSystem['eventBus']['emit']>[0]['name'], payload: Record<string, unknown>): Promise<void> {
    await this.jobs?.eventBus.emit({ name, payload, correlationId: context.correlationId, studentId: context.user?.id, interactionId: context.correlationId });
  }
}

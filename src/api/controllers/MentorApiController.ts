import {
  assessmentRequestSchema,
  bareActAnalysisRequestSchema,
  capstoneReviewRequestSchema,
  chatRequestSchema,
  documentUploadRequestSchema,
  draftReviewRequestSchema,
  draftRevisionRequestSchema,
  idParamSchema,
  lessonActionRequestSchema,
  quizStartRequestSchema,
  quizSubmitRequestSchema,
} from '../dto/schemas';
import { ResponseFactory } from './ResponseFactory';
import { SSE } from '../streaming/SSE';
import { ApiMiddleware } from '../middleware/ApiMiddleware';
import { ApiTelemetry } from '../telemetry/ApiTelemetry';
import { getRoute } from '../routes/routeDefinitions';
import type { ApiRouteId } from '../types';
import { MentorApiService } from '../services/MentorApiService';
import { assertNotProductionDefault } from '../services/ProductionRuntimeSafety';

export interface MentorApiControllerOptions {
  middleware?: ApiMiddleware;
  service?: MentorApiService;
  telemetry?: ApiTelemetry;
}

export class MentorApiController {
  private readonly middleware: ApiMiddleware;
  private readonly service: MentorApiService;
  private readonly telemetry: ApiTelemetry;

  constructor(options: MentorApiControllerOptions = {}) {
    assertNotProductionDefault('MentorApiController', [
      !options.middleware ? 'middleware' : '',
      !options.service ? 'service' : '',
      !options.telemetry ? 'telemetry' : '',
    ].filter(Boolean));
    this.middleware = options.middleware ?? new ApiMiddleware();
    this.service = options.service ?? new MentorApiService();
    this.telemetry = options.telemetry ?? new ApiTelemetry();
  }

  chat(request: Request): Promise<Response> {
    return this.postAI('chat', request, chatRequestSchema, 'learning', 'teach');
  }

  draftReview(request: Request): Promise<Response> {
    return this.postAI('draft_review', request, draftReviewRequestSchema, 'review', 'review');
  }

  draftRevision(request: Request): Promise<Response> {
    return this.postAI('draft_revision', request, draftRevisionRequestSchema, 'revision', 'revision_guidance');
  }

  quizStart(request: Request): Promise<Response> {
    return this.postAI('quiz_start', request, quizStartRequestSchema, 'quiz', 'quiz');
  }

  quizSubmit(request: Request): Promise<Response> {
    return this.postAI('quiz_submit', request, quizSubmitRequestSchema, 'quiz', 'assessment_feedback');
  }

  assessmentStart(request: Request): Promise<Response> {
    return this.postAI('assessment_start', request, assessmentRequestSchema, 'assessment', 'assessment_feedback');
  }

  assessmentSubmit(request: Request): Promise<Response> {
    return this.postAI('assessment_submit', request, assessmentRequestSchema, 'assessment', 'assessment_feedback');
  }

  capstoneReview(request: Request): Promise<Response> {
    return this.postAI('capstone_review', request, capstoneReviewRequestSchema, 'capstone', 'capstone_review');
  }

  bareActAnalyse(request: Request): Promise<Response> {
    return this.postAI('bare_act_analyse', request, bareActAnalysisRequestSchema, 'bare_act_analysis', 'teach');
  }

  async chatStream(request: Request): Promise<Response> {
    const route = getRoute('chat_stream');
    const context = this.middleware.createContext(request, route);
    try {
      this.telemetry.requestStarted(context);
      const authed = await this.middleware.authenticate(request, route, context);
      this.middleware.authorize(route, authed);
      this.middleware.rateLimit(authed);
      const body = await this.middleware.parseJson(request, chatRequestSchema);
      const stream = await this.service.streamAI(authed, body);
      const encoder = new TextEncoder();
      const readable = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const event of stream) {
              controller.enqueue(encoder.encode(SSE.encode(event)));
            }
            controller.close();
          } catch (error) {
            controller.enqueue(encoder.encode(SSE.encode({ event: 'error', data: { message: error instanceof Error ? error.message : String(error) } })));
            controller.close();
          }
        },
      });
      this.telemetry.requestCompleted(authed, 200);
      return SSE.response(readable);
    } catch (error) {
      this.telemetry.requestFailed(context, error instanceof Error ? error : new Error(String(error)), 500);
      return ResponseFactory.error(context, error);
    }
  }

  async lessonStart(request: Request): Promise<Response> {
    return this.lessonAction('lesson_start', request, false);
  }

  async lessonComplete(request: Request): Promise<Response> {
    return this.lessonAction('lesson_complete', request, true);
  }

  async documentsUpload(request: Request): Promise<Response> {
    const route = getRoute('documents_upload');
    const context = this.middleware.createContext(request, route);
    try {
      this.telemetry.requestStarted(context);
      const authed = await this.middleware.authenticate(request, route, context);
      this.middleware.authorize(route, authed);
      this.middleware.rateLimit(authed);
      const body = await this.middleware.parseJson(request, documentUploadRequestSchema);
      const data = await this.service.saveDocument(authed, body);
      this.telemetry.requestCompleted(authed, 201);
      return ResponseFactory.json(authed, data, 201);
    } catch (error) {
      this.telemetry.requestFailed(context, error instanceof Error ? error : new Error(String(error)), 500);
      return ResponseFactory.error(context, error);
    }
  }

  studentResource(kind: 'progress' | 'mastery' | 'projects' | 'history', request: Request): Promise<Response> {
    const routeId = `student_${kind}` as ApiRouteId;
    const route = getRoute(routeId);
    const context = this.middleware.createContext(request, route);
    return this.handleGet(context, request, routeId, () => this.service.getStudentResource(context, kind));
  }

  knowledgeResource(kind: 'pattern' | 'lesson' | 'module', request: Request, params: Record<string, string>): Promise<Response> {
    const routeId = `${kind}_detail` as ApiRouteId;
    const route = getRoute(routeId);
    const context = this.middleware.createContext(request, route, params);
    const parsed = idParamSchema.safeParse(params);
    if (!parsed.success) return Promise.resolve(ResponseFactory.error(context, parsed.error));
    return this.handleGet(context, request, routeId, () => this.service.getKnowledgeResource(context, kind, parsed.data.id));
  }

  private async postAI<T>(
    routeId: ApiRouteId,
    request: Request,
    schema: { parse(input: unknown): T },
    intent: Parameters<MentorApiService['runAI']>[2],
    strategy: Parameters<MentorApiService['runAI']>[3]
  ): Promise<Response> {
    const route = getRoute(routeId);
    const context = this.middleware.createContext(request, route);
    try {
      this.telemetry.requestStarted(context);
      const authed = await this.middleware.authenticate(request, route, context);
      this.middleware.authorize(route, authed);
      this.middleware.rateLimit(authed);
      const body = await this.middleware.parseJson(request, schema as never);
      const result = await this.service.runAI(authed, body as never, intent, strategy);
      this.telemetry.requestCompleted(authed, 200);
      return ResponseFactory.json(authed, {
        text: result.validation?.response.text,
        validation: result.validation?.telemetry,
        usage: result.llm?.usage,
        cost: result.llm?.cost,
        retrieval: result.retrieval ? {
          itemCount: result.retrieval.items.length,
          usedTokens: result.retrieval.usedTokens,
        } : undefined,
      });
    } catch (error) {
      this.telemetry.requestFailed(context, error instanceof Error ? error : new Error(String(error)), 500);
      return ResponseFactory.error(context, error);
    }
  }

  private async lessonAction(routeId: ApiRouteId, request: Request, complete: boolean): Promise<Response> {
    const route = getRoute(routeId);
    const context = this.middleware.createContext(request, route);
    try {
      this.telemetry.requestStarted(context);
      const authed = await this.middleware.authenticate(request, route, context);
      const body = await this.middleware.parseJson(request, lessonActionRequestSchema);
      if (complete) await this.service.completeLesson(authed, body);
      this.telemetry.requestCompleted(authed, 200);
      return ResponseFactory.json(authed, { started: !complete, completed: complete, ...body });
    } catch (error) {
      this.telemetry.requestFailed(context, error instanceof Error ? error : new Error(String(error)), 500);
      return ResponseFactory.error(context, error);
    }
  }

  private async handleGet(context: ReturnType<ApiMiddleware['createContext']>, request: Request, routeId: ApiRouteId, fn: () => Promise<unknown>): Promise<Response> {
    const route = getRoute(routeId);
    try {
      this.telemetry.requestStarted(context);
      const authed = await this.middleware.authenticate(request, route, context);
      const data = await fn();
      this.telemetry.requestCompleted(authed, 200);
      return ResponseFactory.json(authed, data);
    } catch (error) {
      this.telemetry.requestFailed(context, error instanceof Error ? error : new Error(String(error)), 500);
      return ResponseFactory.error(context, error);
    }
  }
}

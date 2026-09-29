import { OpenAIClient } from '../client/OpenAIClient';
import { PromptCache } from '../cache/PromptCache';
import { CostTracker } from '../cost/CostTracker';
import { TokenCounter } from '../cost/TokenCounter';
import { MiddlewarePipeline, AuthenticationMiddleware, AuthorizationMiddleware, ValidationMiddleware } from '../middleware/LLMMiddleware';
import { PromptExecutor } from '../prompts/PromptExecutor';
import { RateLimiter } from '../rate/RateLimiter';
import { RetryManager } from '../retries/RetryManager';
import { TimeoutManager } from '../retries/TimeoutManager';
import { ResponseParser } from './ResponseParser';
import { ResponseValidator } from './ResponseValidator';
import { ResponseStreamer } from '../streaming/ResponseStreamer';
import { TelemetryLogger } from '../telemetry/TelemetryLogger';
import type {
  LLMExecutionRecord,
  LLMResponse,
  LLMStreamEvent,
  LLMToolCall,
  OpenAIResponseRequest,
  OpenAIResponseResult,
  RuntimeDecisionPacket,
  StructuredOutputSpec,
} from '../types';
import { LLMExecutionRepository } from './LLMExecutionRepository';
import { LegalAnswerGuard } from './LegalAnswerGuard';

export interface LLMServiceOptions {
  client?: OpenAIClient;
  promptExecutor?: PromptExecutor;
  retryManager?: RetryManager;
  timeoutManager?: TimeoutManager;
  rateLimiter?: RateLimiter;
  tokenCounter?: TokenCounter;
  costTracker?: CostTracker;
  parser?: ResponseParser;
  validator?: ResponseValidator;
  streamer?: ResponseStreamer;
  telemetry?: TelemetryLogger;
  executionRepository?: LLMExecutionRepository;
  responseCache?: PromptCache<LLMResponse>;
  defaultModel?: string;
  legalGuard?: LegalAnswerGuard;
}

function assertProductionLLMDependencies(options: LLMServiceOptions): void {
  if (typeof process === 'undefined' || process.env.NODE_ENV !== 'production') return;
  const missing = [
    !options.client ? 'client' : '',
    !options.promptExecutor ? 'promptExecutor' : '',
    !options.executionRepository ? 'executionRepository' : '',
    !options.telemetry ? 'telemetry' : '',
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`LLMService is not production-ready: missing required dependencies [${missing.join(', ')}].`);
  }
}

export class LLMService {
  private readonly client: OpenAIClient;
  private readonly promptExecutor: PromptExecutor;
  private readonly retryManager: RetryManager;
  private readonly timeoutManager: TimeoutManager;
  private readonly rateLimiter: RateLimiter;
  private readonly tokenCounter: TokenCounter;
  private readonly costTracker: CostTracker;
  private readonly parser: ResponseParser;
  private readonly validator: ResponseValidator;
  private readonly streamer: ResponseStreamer;
  private readonly telemetry: TelemetryLogger;
  private readonly executionRepository: LLMExecutionRepository;
  private readonly responseCache: PromptCache<LLMResponse>;
  private readonly middleware: MiddlewarePipeline;
  private readonly defaultModel: string;
  private readonly legalGuard: LegalAnswerGuard;

  constructor(options: LLMServiceOptions = {}) {
    assertProductionLLMDependencies(options);
    this.client = options.client ?? new OpenAIClient();
    this.promptExecutor = options.promptExecutor ?? new PromptExecutor();
    this.retryManager = options.retryManager ?? new RetryManager();
    this.timeoutManager = options.timeoutManager ?? new TimeoutManager();
    this.rateLimiter = options.rateLimiter ?? new RateLimiter();
    this.tokenCounter = options.tokenCounter ?? new TokenCounter();
    this.costTracker = options.costTracker ?? new CostTracker();
    this.parser = options.parser ?? new ResponseParser();
    this.validator = options.validator ?? new ResponseValidator();
    this.streamer = options.streamer ?? new ResponseStreamer();
    this.telemetry = options.telemetry ?? new TelemetryLogger();
    this.executionRepository = options.executionRepository ?? new LLMExecutionRepository();
    this.responseCache = options.responseCache ?? new PromptCache<LLMResponse>();
    this.defaultModel = options.defaultModel ?? 'gpt-4.1-mini';
    this.legalGuard = options.legalGuard ?? new LegalAnswerGuard();
    this.middleware = new MiddlewarePipeline([
      new ValidationMiddleware(),
      new AuthenticationMiddleware(),
      new AuthorizationMiddleware(),
    ]);
  }

  generateResponse(packet: RuntimeDecisionPacket): Promise<LLMResponse> {
    return this.middleware.execute(packet, (validated) => this.execute(validated));
  }

  async *streamResponse(packet: RuntimeDecisionPacket): AsyncGenerator<LLMStreamEvent> {
    const validated = await this.middleware.execute(packet, async (next) => next);
    yield* this.executeStream(validated);
  }

  async generateStructuredResponse<T>(packet: RuntimeDecisionPacket, spec: StructuredOutputSpec<T>): Promise<LLMResponse & { parsed: T }> {
    const response = await this.generateResponse({ ...packet, structuredOutput: spec });
    const parsed = this.validator.validateJSON(spec.zodSchema, response.parsed);
    return { ...response, parsed };
  }

  async generateJSON(packet: RuntimeDecisionPacket): Promise<unknown> {
    const response = await this.generateResponse(packet);
    return this.parser.json(response.raw as OpenAIResponseResult);
  }

  generateExplanation(packet: RuntimeDecisionPacket): Promise<LLMResponse> {
    return this.generateResponse(this.withIntent(packet, 'learning'));
  }

  generateDraftReview(packet: RuntimeDecisionPacket): Promise<LLMResponse> {
    return this.generateResponse(this.withIntent(packet, 'review'));
  }

  generateRevisionFeedback(packet: RuntimeDecisionPacket): Promise<LLMResponse> {
    return this.generateResponse(this.withIntent(packet, 'revision'));
  }

  generateQuiz(packet: RuntimeDecisionPacket): Promise<LLMResponse> {
    return this.generateResponse(this.withIntent(packet, 'quiz'));
  }

  generateAssessmentFeedback(packet: RuntimeDecisionPacket): Promise<LLMResponse> {
    return this.generateResponse(this.withIntent(packet, 'assessment'));
  }

  generateCapstoneReview(packet: RuntimeDecisionPacket): Promise<LLMResponse> {
    return this.generateResponse(this.withIntent(packet, 'capstone'));
  }

  generateBareActAnalysis(packet: RuntimeDecisionPacket): Promise<LLMResponse> {
    return this.generateResponse(this.withIntent(packet, 'bare_act_analysis'));
  }

  private async execute(packet: RuntimeDecisionPacket): Promise<LLMResponse> {
    const start = Date.now();
    const span = this.telemetry.startSpan('llm.generate', {
      requestId: packet.requestId,
      interactionId: packet.interactionId,
      intent: packet.intent,
    });

    try {
      await this.rateLimiter.acquire(packet.studentId ?? 'anonymous');
      const assembled = this.promptExecutor.assemble(packet);
      const model = packet.model ?? this.defaultModel;
      const responseCacheKey = this.responseCache.key({ prompt: assembled.prompt.prompt, model, structured: packet.structuredOutput?.name });

      if (packet.cachePolicy?.allowResponseCache) {
        const cached = this.responseCache.get(responseCacheKey);
        if (cached) {
          return cached;
        }
      }

      const timeout = this.timeoutManager.withTimeout(packet.abortSignal);
      const request = this.buildOpenAIRequest(packet, assembled.prompt.prompt, model);
      let retryCount = 0;
      const { value: raw, retries } = await this.retryManager.execute(
        () => this.client.createResponse(request, timeout.signal),
        (attempt) => { retryCount = attempt; }
      );
      timeout.cancel();
      retryCount = retries;

      const response = await this.buildResponse(packet, assembled, raw, Date.now() - start, retryCount);
      if (packet.cachePolicy?.allowResponseCache) {
        this.responseCache.set(responseCacheKey, response, packet.cachePolicy.ttlMs);
      }
      span.end();
      return response;
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      span.recordException(normalized);
      span.end();
      this.telemetry.logError(normalized, { requestId: packet.requestId, interactionId: packet.interactionId });
      throw normalized;
    }
  }

  private async *executeStream(packet: RuntimeDecisionPacket): AsyncGenerator<LLMStreamEvent> {
    const start = Date.now();
    await this.rateLimiter.acquire(packet.studentId ?? 'anonymous');
    const assembled = this.promptExecutor.assemble(packet);
    const model = packet.model ?? this.defaultModel;
    const timeout = this.timeoutManager.withTimeout(packet.abortSignal);
    const request = this.buildOpenAIRequest(packet, assembled.prompt.prompt, model, true);
    const { value: body } = await this.retryManager.execute(() => this.client.streamResponse(request, timeout.signal));

    yield* this.streamer.stream(body, packet, async (text, raw, toolCalls, streamDurationMs) => {
      const mergedRaw = { ...raw, output_text: text };
      const response = await this.buildResponse(packet, assembled, mergedRaw, Date.now() - start, 0, streamDurationMs, toolCalls);
      timeout.cancel();
      return {
        type: 'completion',
        requestId: packet.requestId,
        interactionId: packet.interactionId,
        response,
        timestamp: Date.now(),
      };
    });
  }

  private buildOpenAIRequest(packet: RuntimeDecisionPacket, prompt: string, model: string, stream = false): OpenAIResponseRequest {
    const request: OpenAIResponseRequest = {
      model,
      input: prompt,
      stream,
      temperature: packet.temperature,
      max_output_tokens: packet.maxOutputTokens,
      metadata: {
        request_id: packet.requestId,
        interaction_id: packet.interactionId,
        intent: packet.intent,
        strategy: packet.teachingStrategy,
      },
    };

    if (packet.tools?.length) {
      request.tools = packet.tools.map((tool) => ({
        type: 'function',
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }));
    }

    if (packet.structuredOutput) {
      request.text = {
        format: {
          type: 'json_schema',
          name: packet.structuredOutput.name,
          description: packet.structuredOutput.description,
          schema: packet.structuredOutput.jsonSchema,
          strict: packet.structuredOutput.strict ?? true,
        },
      };
    }

    return request;
  }

  private async buildResponse(
    packet: RuntimeDecisionPacket,
    assembled: ReturnType<PromptExecutor['assemble']>,
    raw: OpenAIResponseResult,
    latencyMs: number,
    retryCount: number,
    streamDurationMs?: number,
    streamToolCalls?: LLMToolCall[]
  ): Promise<LLMResponse> {
    const text = this.validator.validateText(this.parser.text(raw));
    const toolCalls = streamToolCalls ?? this.parser.toolCalls(raw);
    const model = raw.model ?? packet.model ?? this.defaultModel;
    const parsed = packet.structuredOutput ? this.validator.validateJSON(packet.structuredOutput.zodSchema, this.parser.json(raw)) : undefined;
    const usage = this.tokenCounter.fromResponse(assembled.prompt, raw, text);
    const cost = this.costTracker.calculate(model, usage, text.length);
    const telemetry = this.buildTelemetry(packet, assembled.version, model, latencyMs, retryCount, assembled.cacheHit, toolCalls, usage, cost, streamDurationMs);

    await this.executionRepository.save(telemetry);
    this.telemetry.logExecution(telemetry);

    return {
      requestId: packet.requestId,
      interactionId: packet.interactionId,
      text,
      model,
      prompt: assembled.prompt,
      parsed,
      toolCalls,
      usage,
      cost,
      telemetry,
      raw,
    };
  }

  private buildTelemetry(
    packet: RuntimeDecisionPacket,
    promptVersion: string,
    model: string,
    latencyMs: number,
    retryCount: number,
    cacheHit: boolean,
    toolCalls: LLMToolCall[],
    usage: LLMResponse['usage'],
    cost: LLMResponse['cost'],
    streamDurationMs?: number
  ): LLMExecutionRecord {
    return {
      requestId: packet.requestId,
      interactionId: packet.interactionId,
      studentId: packet.studentId,
      intent: packet.intent,
      teachingStrategy: packet.teachingStrategy,
      promptVersion,
      model,
      latencyMs,
      streamDurationMs,
      retryCount,
      cacheHit,
      toolCalls,
      usage,
      cost,
      retrievalStatistics: packet.retrieval ? {
        itemCount: packet.retrieval.items.length,
        omittedCount: packet.retrieval.omitted.length,
        usedTokens: packet.retrieval.usedTokens,
        tokenBudget: packet.retrieval.tokenBudget,
        warnings: packet.retrieval.warnings,
      } : undefined,
    };
  }

  private withIntent(packet: RuntimeDecisionPacket, intent: RuntimeDecisionPacket['intent']): RuntimeDecisionPacket {
    return {
      ...packet,
      intent,
      promptRequest: {
        ...packet.promptRequest,
        intent,
      },
    };
  }
}


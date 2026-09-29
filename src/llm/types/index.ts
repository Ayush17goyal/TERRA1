import type { z } from 'zod';
import type { AssembledPrompt, PromptAssemblyRequest, PromptIntent, TeachingStrategy } from '../../ai/prompts/types';
import type { KnowledgeRetrievalResult } from '../../knowledge/types';

export type LLMMethod =
  | 'generateResponse'
  | 'streamResponse'
  | 'generateStructuredResponse'
  | 'generateJSON'
  | 'generateExplanation'
  | 'generateDraftReview'
  | 'generateRevisionFeedback'
  | 'generateQuiz'
  | 'generateAssessmentFeedback'
  | 'generateCapstoneReview'
  | 'generateBareActAnalysis';

export type StreamEventType = 'text_delta' | 'tool_event' | 'completion' | 'error' | 'cancellation';

export interface RuntimeDecisionPacket {
  requestId: string;
  interactionId: string;
  studentId?: string;
  sessionId?: string;
  intent: PromptIntent;
  teachingStrategy: TeachingStrategy;
  promptRequest: PromptAssemblyRequest;
  retrieval?: KnowledgeRetrievalResult;
  model?: string;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  maxOutputTokens?: number;
  tools?: LLMToolDefinition[];
  structuredOutput?: StructuredOutputSpec<unknown>;
  cachePolicy?: CachePolicy;
  metadata?: Record<string, unknown>;
  abortSignal?: AbortSignal;
}

export interface CachePolicy {
  allowPromptCache?: boolean;
  allowResponseCache?: boolean;
  ttlMs?: number;
}

export interface StructuredOutputSpec<T> {
  name: string;
  description?: string;
  jsonSchema: Record<string, unknown>;
  zodSchema: z.ZodType<T>;
  strict?: boolean;
}

export interface LLMToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMToolResult {
  toolCallId: string;
  output: unknown;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  systemPromptTokens: number;
  knowledgeTokens: number;
  studentContextTokens: number;
  draftTokens: number;
}

export interface LLMCost {
  model: string;
  inputCostUsd: number;
  outputCostUsd: number;
  estimatedCostUsd: number;
  actualCostUsd?: number;
  completionLength: number;
}

export interface LLMExecutionRecord {
  requestId: string;
  interactionId: string;
  studentId?: string;
  intent: PromptIntent;
  teachingStrategy: TeachingStrategy;
  promptVersion: string;
  model: string;
  latencyMs: number;
  streamDurationMs?: number;
  retryCount: number;
  cacheHit: boolean;
  toolCalls: LLMToolCall[];
  usage: LLMUsage;
  cost: LLMCost;
  retrievalStatistics?: RetrievalStatistics;
}

export interface RetrievalStatistics {
  itemCount: number;
  omittedCount: number;
  usedTokens: number;
  tokenBudget: number;
  warnings: string[];
}

export interface LLMResponse {
  requestId: string;
  interactionId: string;
  text: string;
  model: string;
  prompt: AssembledPrompt;
  parsed?: unknown;
  toolCalls: LLMToolCall[];
  usage: LLMUsage;
  cost: LLMCost;
  telemetry: LLMExecutionRecord;
  raw: unknown;
}

export interface LLMStreamEvent {
  type: StreamEventType;
  requestId: string;
  interactionId: string;
  delta?: string;
  toolCall?: LLMToolCall;
  response?: LLMResponse;
  error?: Error;
  timestamp: number;
}

export interface OpenAIResponseRequest {
  model: string;
  input: string;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  max_output_tokens?: number;
  tools?: Array<Record<string, unknown>>;
  text?: Record<string, unknown>;
  metadata?: Record<string, string>;
}

export interface OpenAIResponseResult {
  id?: string;
  model?: string;
  output_text?: string;
  output?: unknown[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  [key: string]: unknown;
}

export interface LoggerLike {
  info(data: unknown, message?: string): void;
  warn(data: unknown, message?: string): void;
  error(data: unknown, message?: string): void;
  debug?(data: unknown, message?: string): void;
}

export interface TelemetrySink {
  startSpan(name: string, attributes?: Record<string, unknown>): TelemetrySpan;
  recordMetric(name: string, value: number, attributes?: Record<string, unknown>): void;
}

export interface TelemetrySpan {
  setAttribute(name: string, value: unknown): void;
  recordException(error: Error): void;
  end(): void;
}


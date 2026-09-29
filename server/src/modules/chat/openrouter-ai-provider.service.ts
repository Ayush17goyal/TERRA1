import { Injectable, Logger, Optional, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import { FallbackMetricsService } from './fallback-metrics.service';
import { TokenOptimizationService } from './token-optimization.service';
import { ByokService } from '../settings/byok.service';
import { AiAccessReservation, CreditService } from '../settings/credit.service';
import { ProviderManagementService } from '../settings/provider-management.service';

type ProviderMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type OpenRouterProvider = {
  name: string;
  model: string;
};

// ─── Adaptive Timeout Config ──────────────────────────────────────────────────

interface ProviderTimeoutConfig {
  defaultTimeoutMs: number;
  maxTimeoutMs: number;
  retryCount: number;
}

// Per-provider timeout budgets based on observed latency characteristics
const PROVIDER_TIMEOUT_CONFIG: Record<string, ProviderTimeoutConfig> = {
  'google/gemini-2.5-flash':       { defaultTimeoutMs: 120_000, maxTimeoutMs: 150_000, retryCount: 1 },
  'openai/gpt-4o-mini':            { defaultTimeoutMs:  90_000, maxTimeoutMs: 120_000, retryCount: 1 },
  'deepseek/deepseek-r1':          { defaultTimeoutMs:  90_000, maxTimeoutMs: 120_000, retryCount: 1 },
  // Direct providers
  Groq:                            { defaultTimeoutMs:  45_000, maxTimeoutMs:  60_000, retryCount: 2 },
  OpenAI:                          { defaultTimeoutMs:  90_000, maxTimeoutMs: 120_000, retryCount: 1 },
  Gemini:                          { defaultTimeoutMs: 120_000, maxTimeoutMs: 150_000, retryCount: 1 },
  DeepSeek:                        { defaultTimeoutMs:  90_000, maxTimeoutMs: 120_000, retryCount: 1 },
  xAI:                             { defaultTimeoutMs:  60_000, maxTimeoutMs:  90_000, retryCount: 1 },
};

const DEFAULT_TIMEOUT_CONFIG: ProviderTimeoutConfig = { defaultTimeoutMs: 90_000, maxTimeoutMs: 120_000, retryCount: 1 };

// ─── In-memory timing metrics (ring buffer, last 50 samples per provider) ────

interface ProviderSample { durationMs: number; succeeded: boolean; timedOut: boolean; ts: number }

const providerMetrics: Record<string, ProviderSample[]> = {};
const METRICS_WINDOW = 50;

function recordSample(key: string, sample: ProviderSample) {
  if (!providerMetrics[key]) providerMetrics[key] = [];
  providerMetrics[key].push(sample);
  if (providerMetrics[key].length > METRICS_WINDOW) providerMetrics[key].shift();
}

function getMetricsSummary(key: string): { avg: number; p95: number; successRate: number; sampleCount: number; recommendedTimeoutMs: number } {
  const samples = providerMetrics[key];
  if (!samples || samples.length === 0) return { avg: 0, p95: 0, successRate: 1, sampleCount: 0, recommendedTimeoutMs: (PROVIDER_TIMEOUT_CONFIG[key] ?? DEFAULT_TIMEOUT_CONFIG).defaultTimeoutMs };

  const durations = samples.map(s => s.durationMs).sort((a, b) => a - b);
  const successCount = samples.filter(s => s.succeeded).length;
  const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  const p95 = durations[Math.floor(durations.length * 0.95)] ?? durations[durations.length - 1];
  const successRate = successCount / samples.length;

  const cfg = PROVIDER_TIMEOUT_CONFIG[key] ?? DEFAULT_TIMEOUT_CONFIG;
  // Recommended = p95 × 1.3, clamped between default and max
  const recommended = Math.min(cfg.maxTimeoutMs, Math.max(cfg.defaultTimeoutMs, Math.round(p95 * 1.3)));

  return { avg, p95, successRate, sampleCount: samples.length, recommendedTimeoutMs: recommended };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type AiProviderCompletionInput = {
  messages: ProviderMessage[];
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  maxTokens?: number;
  timeoutMs?: number;
  preferredModel?: string;
  module?: 'lexmentor' | 'research' | 'judgment' | 'notebook' | 'studyforge' | 'exam' | 'memorial' | 'bench';
  jsonMode?: boolean;
  onToken?: (token: string) => void;
  userId?: string;
};

export type AiProviderTimingAudit = {
  provider: string;
  model: string;
  configuredTimeoutMs: number;
  actualDurationMs: number;
  timedOut: boolean;
  succeeded: boolean;
  retryAttempt: number;
};

export type AiProviderCompletionResult = {
  content: string;
  provider: string;
  model: string;
  responseTimeMs: number;
  timingAudit: AiProviderTimingAudit;
};

@Injectable()
export class OpenRouterAiProviderService {
  private readonly logger = new Logger(OpenRouterAiProviderService.name);

  constructor(
    private readonly metricsService: FallbackMetricsService,
    private readonly tokenService: TokenOptimizationService,
    @Optional() private readonly byokService?: ByokService,
    @Optional() private readonly creditService?: CreditService,
    @Optional() private readonly providerManagement?: ProviderManagementService,
  ) {}

  private readonly providers: OpenRouterProvider[] = [
    { name: 'Gemini',     model: 'google/gemini-2.5-flash' },
    { name: 'GPT-4o-Mini', model: 'openai/gpt-4o-mini' },
    { name: 'DeepSeek',   model: 'deepseek/deepseek-r1' },
  ];

  // ── Adaptive timeout helpers ────────────────────────────────────────────────

  private resolveTimeout(providerKey: string, callerOverrideMs?: number): number {
    const cfg = PROVIDER_TIMEOUT_CONFIG[providerKey] ?? DEFAULT_TIMEOUT_CONFIG;
    const summary = getMetricsSummary(providerKey);

    // Caller may pass a hard ceiling (e.g. request-level budget); never exceed it.
    const adaptive = summary.sampleCount >= 5 ? summary.recommendedTimeoutMs : cfg.defaultTimeoutMs;
    const resolved = callerOverrideMs ? Math.min(callerOverrideMs, cfg.maxTimeoutMs) : adaptive;

    return Math.max(resolved, cfg.defaultTimeoutMs);
  }

  private logTimingAudit(key: string, durationMs: number, configuredMs: number, succeeded: boolean) {
    const timedOut = !succeeded && durationMs >= configuredMs - 500;
    recordSample(key, { durationMs, succeeded, timedOut, ts: Date.now() });

    const { avg, p95, successRate, sampleCount, recommendedTimeoutMs } = getMetricsSummary(key);
    const flag = timedOut ? ' ⚠ TIMED OUT' : '';
    this.logger.log(
      `[AdaptiveTimeout] provider=${key} | configured=${configuredMs}ms | actual=${durationMs}ms | timedOut=${timedOut}${flag}` +
      ` | samples=${sampleCount} avg=${avg}ms p95=${p95}ms successRate=${(successRate * 100).toFixed(0)}% recommendedTimeout=${recommendedTimeoutMs}ms`,
    );

    if (timedOut) {
      this.logger.warn(
        `[AdaptiveTimeout] ${key} timed out at ${durationMs}ms (configured=${configuredMs}ms). ` +
        `Recommended timeout for this provider: ${recommendedTimeoutMs}ms`,
      );
    } else if (succeeded && durationMs > configuredMs * 0.8) {
      this.logger.warn(
        `[AdaptiveTimeout] ${key} completed in ${durationMs}ms — within 20% of configured timeout (${configuredMs}ms). ` +
        `Consider raising timeout to ${recommendedTimeoutMs}ms.`,
      );
    }
  }

  getProviderMetricsTable(): string {
    const rows = Object.entries(providerMetrics).map(([key]) => {
      const { avg, p95, successRate, sampleCount, recommendedTimeoutMs } = getMetricsSummary(key);
      const cfg = PROVIDER_TIMEOUT_CONFIG[key] ?? DEFAULT_TIMEOUT_CONFIG;
      return `| ${key.padEnd(30)} | ${String(avg).padStart(8)}ms | ${String(p95).padStart(8)}ms | ${String(cfg.defaultTimeoutMs).padStart(8)}ms | ${(successRate * 100).toFixed(0).padStart(7)}% | ${String(recommendedTimeoutMs).padStart(12)}ms |`;
    });
    const header = `| ${'Provider'.padEnd(30)} | ${'Avg Dur'.padStart(9)} | ${'p95 Dur'.padStart(9)} | ${'Timeout'.padStart(9)} | ${'Success%'.padStart(8)} | ${'Recommended'.padStart(13)} |`;
    const sep    = `|-${'-'.repeat(30)}-|-${'-'.repeat(9)}-|-${'-'.repeat(9)}-|-${'-'.repeat(9)}-|-${'-'.repeat(8)}-|-${'-'.repeat(13)}-|`;
    return [header, sep, ...rows].join('\n');
  }

  // ── Main entry ──────────────────────────────────────────────────────────────

  async complete(input: AiProviderCompletionInput): Promise<AiProviderCompletionResult> {
    this.metricsService.incrementRequest();
    let creditReservation: AiAccessReservation | null = null;

    if (input.userId && this.creditService) {
      creditReservation = await this.creditService.reserveForSystemProvider(input.userId, input.module);
    }

    if (creditReservation?.route === 'byok' && input.userId && this.byokService) {
      try {
        const userKey = await this.byokService.getAnyDecryptedKey(input.userId);
        if (userKey) {
          const result = await this.callWithDirectKey(input, userKey.apiKey, userKey.baseURL, userKey.model, userKey.provider);
          if (result) {
            await this.byokService.trackUsage(input.userId, true);
            await this.byokService.updateProviderStatus(input.userId, userKey.provider, 'Connected');
            this.logger.log(`BYOK provider succeeded for provider=${userKey.provider}.`);
            return result;
          }
        }
      } catch (error: any) {
        this.logger.warn(`BYOK attempt failed, falling through to system keys: ${this.getSafeErrorMessage(error)}`);
      }
    }

    // Credits exhausted — fall through to system keys; credits are advisory, not a hard gate.
    if (creditReservation?.route === 'byok') {
      this.logger.warn(`Credits exhausted for module=${creditReservation.moduleKey}; continuing with system provider keys.`);
    }

    const managedOpenRouterKey = await this.providerManagement?.getActiveApiKey('openrouter');
    const apiKey = managedOpenRouterKey?.apiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey || /placeholder/i.test(apiKey)) {
      this.logger.warn('OPENROUTER_API_KEY is not configured; trying configured direct system providers.');
      const directResult = await this.tryConfiguredDirectProvider(input);
      if (directResult) return directResult;
      await this.creditService?.refundReservation(input.userId, creditReservation, 'system_provider_unavailable');
      throw new ServiceUnavailableException('No configured AI provider is currently available.');
    }

    const errors: string[] = [];
    let hasLimitHit = false;
    const activeProviders = [...this.providers];
    if (input.preferredModel) {
      const preferredIdx = activeProviders.findIndex(
        (p) => p.model.toLowerCase() === input.preferredModel!.toLowerCase() ||
               p.name.toLowerCase()  === input.preferredModel!.toLowerCase(),
      );
      if (preferredIdx !== -1) {
        const [preferred] = activeProviders.splice(preferredIdx, 1);
        activeProviders.unshift(preferred);
      }
    }

    const { OpenAI } = require('openai');

    for (const provider of activeProviders) {
      const cfg = PROVIDER_TIMEOUT_CONFIG[provider.model] ?? DEFAULT_TIMEOUT_CONFIG;
      const maxRetries = cfg.retryCount;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const resolvedTimeout = this.resolveTimeout(provider.model, input.timeoutMs);
        const openaiClient = new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1', timeout: resolvedTimeout });
        const started = Date.now();

        try {
          const { content, promptTokens, completionTokens } = await this.createCompletion(openaiClient, input, provider.model);
          const durationMs = Date.now() - started;

          if (!content) throw new Error('OpenRouter returned an empty response.');

          this.logTimingAudit(provider.model, durationMs, resolvedTimeout, true);
          this.tokenService.logUsage(this.normalizeTokenModule(input.module), promptTokens, completionTokens);
          this.logger.log(`Provider used: ${provider.name} | Model: ${provider.model} | Latency: ${durationMs}ms | Tokens: prompt=${promptTokens}, completion=${completionTokens}`);

          if (provider.model.includes('gemini'))   this.metricsService.incrementHit(1);
          else if (provider.model.includes('gpt-4o')) this.metricsService.incrementHit(2);
          else if (provider.model.includes('deepseek')) this.metricsService.incrementHit(3);

          if (input.userId && this.byokService) this.byokService.trackUsage(input.userId, false).catch(() => {});
          if (managedOpenRouterKey && this.providerManagement) {
            this.providerManagement.recordSuccess('openrouter', managedOpenRouterKey.keyId, input.module, durationMs, promptTokens, completionTokens).catch(() => {});
          }

          return {
            content,
            provider: 'LexMentor AI Engine',
            model: 'LexMentor Core',
            responseTimeMs: durationMs,
            timingAudit: {
              provider: provider.name,
              model: provider.model,
              configuredTimeoutMs: resolvedTimeout,
              actualDurationMs: durationMs,
              timedOut: false,
              succeeded: true,
              retryAttempt: attempt,
            },
          };
        } catch (error: any) {
          const durationMs = Date.now() - started;
          const timedOut = durationMs >= resolvedTimeout - 500;
          this.logTimingAudit(provider.model, durationMs, resolvedTimeout, false);

          const message = this.getSafeErrorMessage(error);
          this.logger.warn(`Provider failed: ${provider.name} | model=${provider.model} | attempt=${attempt + 1}/${maxRetries + 1} | latency=${durationMs}ms | timedOut=${timedOut} | reason=${message}`);

          if (attempt < maxRetries) {
            this.logger.log(`Retrying ${provider.name} (attempt ${attempt + 2}/${maxRetries + 1})…`);
            continue;
          }

          errors.push(`${provider.name}/${provider.model} (${maxRetries + 1} attempts): ${message}`);
          this.metricsService.recordFailure(provider.model);
          if (this.providerManagement) {
            const classified = this.providerManagement.classifyError(error);
            if (classified && (classified.failureType === 'quota' || classified.failureType === 'billing' || classified.failureType === 'rate_limit')) hasLimitHit = true;
            if (managedOpenRouterKey) {
              this.providerManagement.recordFailure('openrouter', managedOpenRouterKey.keyId, error, input.module, provider.model).catch(() => {});
            }
          }
        }
      }
    }

    this.logger.error(`All OpenRouter providers failed.\n${this.getProviderMetricsTable()}\nReasons: ${errors.join(' | ')}`);
    this.logger.warn('OpenRouter exhausted — falling back to direct system providers.');
    const directResult = await this.tryConfiguredDirectProvider(input);
    if (directResult) return directResult;

    await this.creditService?.refundReservation(input.userId, creditReservation, 'all_system_providers_failed');
    if (hasLimitHit) throw new ServiceUnavailableException('Site is handling too many requests; will be available in 15 minutes');
    throw new ServiceUnavailableException('The AI generation service is temporarily unavailable. Please try again later.');
  }

  // ── Direct provider fallback chain ──────────────────────────────────────────

  private async tryConfiguredDirectProvider(input: AiProviderCompletionInput): Promise<AiProviderCompletionResult | null> {
    const candidates = [
      // Groq: each model has its own independent rate-limit bucket — try fast model first
      { name: 'Groq-Fast',    key: process.env.GROQ_API_KEY,     baseURL: 'https://api.groq.com/openai/v1',                         model: 'llama-3.1-8b-instant',                                   maxTokens: 8000 },
      { name: 'Groq-Gemma',   key: process.env.GROQ_API_KEY,     baseURL: 'https://api.groq.com/openai/v1',                         model: 'gemma2-9b-it',                                           maxTokens: 8000 },
      { name: 'Groq',         key: process.env.GROQ_API_KEY,     baseURL: 'https://api.groq.com/openai/v1',                         model: process.env.GROQ_MODEL    || 'llama-3.3-70b-versatile',   maxTokens: 6000 },
      { name: 'OpenAI',       key: process.env.OPENAI_API_KEY,   baseURL: undefined,                                                model: process.env.OPENAI_MODEL  || 'gpt-4o-mini',               maxTokens: 8000 },
      { name: 'DeepSeek',     key: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com/v1',                            model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',             maxTokens: 8000 },
      { name: 'xAI',          key: process.env.XAI_API_KEY,      baseURL: 'https://api.x.ai/v1',                                   model: process.env.XAI_MODEL     || 'grok-3-mini',               maxTokens: 8000 },
      { name: 'AI_ML',        key: process.env.AI_ML_API_KEY,    baseURL: 'https://api.aimlapi.com/v1',                            model: 'gpt-4o-mini',                                             maxTokens: 8000 },
      { name: 'Gemini',       key: process.env.GEMINI_API_KEY,   baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',          maxTokens: 8000 },
    ].filter(c => c.key && !/placeholder/i.test(c.key));

    for (const candidate of candidates) {
      this.logger.log(`Trying direct system provider=${candidate.name}; model=${candidate.model}; maxTokens=${candidate.maxTokens}.`);
      // Cap maxTokens to the direct provider's safe limit (free-tier providers reject large token requests)
      const cappedInput = { ...input, maxTokens: Math.min(input.maxTokens ?? candidate.maxTokens, candidate.maxTokens) };
      const result = await this.callWithDirectKey(cappedInput, candidate.key!, candidate.baseURL, candidate.model, candidate.name);
      if (result) return result;
    }
    this.logger.error('No direct system provider succeeded.');
    return null;
  }

  private async callWithDirectKey(
    input: AiProviderCompletionInput,
    apiKey: string,
    baseURL: string | undefined,
    model: string,
    providerName: string,
  ): Promise<AiProviderCompletionResult | null> {
    const { OpenAI } = require('openai');
    const resolvedTimeout = this.resolveTimeout(providerName, input.timeoutMs);
    const client = new OpenAI({ apiKey, baseURL, timeout: resolvedTimeout });
    const started = Date.now();

    try {
      const { content, promptTokens, completionTokens } = await this.createCompletion(client, input, model);
      if (!content) return null;

      const durationMs = Date.now() - started;
      this.logTimingAudit(providerName, durationMs, resolvedTimeout, true);
      this.tokenService.logUsage(this.normalizeTokenModule(input.module), promptTokens, completionTokens);
      this.logger.log(`Direct provider succeeded: ${providerName}; model=${model}; latency=${durationMs}ms.`);

      return {
        content,
        provider: 'LexMentor AI Engine',
        model: 'LexMentor Core',
        responseTimeMs: durationMs,
        timingAudit: {
          provider: providerName,
          model,
          configuredTimeoutMs: resolvedTimeout,
          actualDurationMs: durationMs,
          timedOut: false,
          succeeded: true,
          retryAttempt: 0,
        },
      };
    } catch (error: any) {
      const durationMs = Date.now() - started;
      this.logTimingAudit(providerName, durationMs, resolvedTimeout, false);
      if (input.userId && this.byokService) {
        const status = this.byokService.classifyProviderError(error);
        await this.byokService.updateProviderStatus(input.userId, providerName, status);
      }
      this.logger.warn(`Direct provider failed: ${providerName} | latency=${durationMs}ms | reason=${this.getSafeErrorMessage(error)}`);
      return null;
    }
  }

  private async createCompletion(
    client: any,
    input: AiProviderCompletionInput,
    model: string,
  ): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
    let content = '';
    let promptTokens = 0;
    let completionTokens = 0;

    if (input.onToken) {
      const stream = await client.chat.completions.create({
        model,
        messages: input.messages,
        temperature: input.temperature ?? 0.2,
        top_p: input.topP,
        frequency_penalty: input.frequencyPenalty,
        presence_penalty: input.presencePenalty,
        max_tokens: input.maxTokens ?? 1200,
        response_format: input.jsonMode ? { type: 'json_object' } : undefined,
        stream: true,
      });

      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || '';
        if (token) {
          content += token;
          input.onToken(token);
        }
      }

      promptTokens = Math.ceil(input.messages.reduce((acc, message) => acc + message.content.length, 0) / 4);
      completionTokens = Math.ceil(content.length / 4);
    } else {
      const completion = await client.chat.completions.create({
        model,
        messages: input.messages,
        temperature: input.temperature ?? 0.2,
        top_p: input.topP,
        frequency_penalty: input.frequencyPenalty,
        presence_penalty: input.presencePenalty,
        max_tokens: input.maxTokens ?? 1200,
        response_format: input.jsonMode ? { type: 'json_object' } : undefined,
      });

      content = completion.choices[0]?.message?.content?.trim() || '';
      promptTokens = completion.usage?.prompt_tokens || 0;
      completionTokens = completion.usage?.completion_tokens || 0;
    }

    return { content, promptTokens, completionTokens };
  }

  private normalizeTokenModule(
    moduleName?: AiProviderCompletionInput['module'],
  ): 'lexmentor' | 'research' | 'judgment' | 'notebook' {
    if (moduleName === 'research' || moduleName === 'judgment' || moduleName === 'notebook' || moduleName === 'lexmentor') {
      return moduleName;
    }
    if (moduleName === 'studyforge') return 'notebook';
    if (moduleName === 'exam') return 'lexmentor';
    return 'lexmentor';
  }

  private getSafeErrorMessage(error: any): string {
    const redact = (value: string) =>
      value
        .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
        .replace(/sk-proj-[A-Za-z0-9._-]+/gi, '[REDACTED_OPENAI_KEY]')
        .replace(/sk-[A-Za-z0-9._-]+/gi, '[REDACTED_OPENAI_KEY]')
        .replace(/gsk_[A-Za-z0-9._-]+/gi, '[REDACTED_GROQ_KEY]')
        .replace(/AIza[A-Za-z0-9._-]+/gi, '[REDACTED_GEMINI_KEY]')
        .slice(0, 220);

    if (error?.status) {
      return redact(`HTTP ${error.status}: ${error.message}`);
    }

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.error?.message || error.response?.data?.message || error.message;
      return redact(status ? `HTTP ${status}: ${message}` : message);
    }

    if (error instanceof Error) return redact(error.message);
    return redact(String(error));
  }
}

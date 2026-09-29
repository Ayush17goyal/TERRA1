import type { OpenAIResponseRequest, OpenAIResponseResult } from '../types';

export interface OpenAIClientOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export class OpenAIClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: OpenAIClientOptions = {}) {
    this.apiKey = options.apiKey ?? (typeof process !== 'undefined' ? process.env.OPENAI_API_KEY ?? '' : '');
    this.baseUrl = options.baseUrl ?? 'https://api.openai.com/v1';
    this.timeoutMs = options.timeoutMs ?? 60000;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async createResponse(request: OpenAIResponseRequest, signal?: AbortSignal): Promise<OpenAIResponseResult> {
    const response = await this.post('/responses', request, signal);
    return await response.json() as OpenAIResponseResult;
  }

  async streamResponse(request: OpenAIResponseRequest, signal?: AbortSignal): Promise<ReadableStream<Uint8Array>> {
    const response = await this.post('/responses', { ...request, stream: true }, signal);
    if (!response.body) {
      throw new Error('OpenAI stream response did not include a body.');
    }
    return response.body;
  }

  private async post(path: string, body: OpenAIResponseRequest, signal?: AbortSignal): Promise<Response> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is required for LLM execution.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const compositeSignal = this.mergeSignals(controller.signal, signal);

    try {
      const response = await this.fetchFn(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: compositeSignal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        const error = new Error(`OpenAI Responses API failed with ${response.status}: ${text}`);
        (error as Error & { status?: number }).status = response.status;
        throw error;
      }

      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  private mergeSignals(primary: AbortSignal, secondary?: AbortSignal): AbortSignal {
    if (!secondary) {
      return primary;
    }

    const controller = new AbortController();
    const abort = () => controller.abort();
    primary.addEventListener('abort', abort, { once: true });
    secondary.addEventListener('abort', abort, { once: true });
    return controller.signal;
  }
}

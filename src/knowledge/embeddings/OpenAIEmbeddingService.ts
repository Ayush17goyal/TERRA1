import type { EmbeddingService } from '../types';

export interface OpenAIEmbeddingServiceOptions {
  apiKey?: string;
  model?: string;
  dimensions?: number;
  endpoint?: string;
  timeoutMs?: number;
}

export class OpenAIEmbeddingService implements EmbeddingService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly dimensions?: number;
  private readonly endpoint: string;
  private readonly timeoutMs: number;

  constructor(options: OpenAIEmbeddingServiceOptions = {}) {
    this.apiKey = options.apiKey ?? (typeof process !== 'undefined' ? process.env.OPENAI_API_KEY ?? '' : '');
    this.model = options.model ?? 'text-embedding-3-small';
    this.dimensions = options.dimensions;
    this.endpoint = options.endpoint ?? 'https://api.openai.com/v1/embeddings';
    this.timeoutMs = options.timeoutMs ?? 30000;
  }

  getVectorSize(): number {
    return this.dimensions ?? 1536;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const [embedding] = await this.generateBatchEmbeddings([text]);
    return embedding;
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is required for embedding generation.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const body: Record<string, unknown> = {
        model: this.model,
        input: texts,
      };

      if (this.dimensions) {
        body.dimensions = this.dimensions;
      }

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`OpenAI embeddings failed with ${response.status}: ${errorText}`);
      }

      const payload = await response.json();
      const embeddings = payload?.data?.map((item: { embedding: number[] }) => item.embedding);

      if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
        throw new Error('OpenAI embeddings response did not match requested input count.');
      }

      return embeddings;
    } finally {
      clearTimeout(timeout);
    }
  }
}

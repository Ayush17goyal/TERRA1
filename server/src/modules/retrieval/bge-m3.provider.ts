import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import OpenAI from 'openai';

/**
 * BGE-M3 Embedding Provider
 * ==========================
 * Calls the optional Python FastAPI sidecar running BAAI/bge-m3 to generate
 * 1024-dimensional dense embeddings for legal documents.
 */
@Injectable()
export class BgeM3Provider implements OnModuleInit {
  private readonly logger = new Logger(BgeM3Provider.name);
  private client?: AxiosInstance;
  private serviceUrl = '';
  private isHealthy = false;
  private isConfigured = false;

  // OpenAI fallback (text-embedding-3-small with dimensions=1024 via Matryoshka)
  private openaiClient?: OpenAI;
  private usingOpenAiFallback = false;

  private readonly VECTOR_SIZE = 1024;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000;
  private readonly EMBED_TIMEOUT_MS = 120_000;  // 2 min — BGE-M3 on CPU is slow

  onModuleInit() {
    this.serviceUrl = process.env.BGE_M3_SERVICE_URL || '';
    this.isConfigured = Boolean(this.serviceUrl);

    if (!this.isConfigured) {
      // Try OpenAI fallback
      const openaiKey = process.env.OPENAI_API_KEY;
      if (openaiKey) {
        this.openaiClient = new OpenAI({ apiKey: openaiKey });
        this.usingOpenAiFallback = true;
        this.isHealthy = true;
        this.logger.log('BGE_M3_SERVICE_URL not set — using OpenAI text-embedding-3-small (1024-dim) as fallback.');
      } else {
        this.logger.warn('BGE_M3_SERVICE_URL and OPENAI_API_KEY are both unset. Embeddings disabled.');
      }
      return;
    }

    // Allow localhost in any environment — if the URL is explicitly set, trust it.
    // (Cloud deployments should use a remote BGE-M3 URL, not localhost.)
    this.logger.log(`Initializing BGE-M3 provider -> ${this.serviceUrl}`);

    this.client = axios.create({
      baseURL: this.serviceUrl,
      timeout: this.EMBED_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' },
    });

    this.checkHealth().catch(() => {});
  }

  getVectorSize(): number {
    return this.VECTOR_SIZE;
  }

  isAvailable(): boolean {
    return this.isHealthy || this.usingOpenAiFallback;
  }

  async checkHealth(): Promise<{ status: string; model: string }> {
    if (!this.isConfigured || !this.client) {
      this.isHealthy = false;
      throw new Error('BGE_M3_SERVICE_URL is not configured.');
    }

    try {
      const { data } = await this.client.get('/health');
      this.isHealthy = data.status === 'healthy';
      this.logger.log(`BGE-M3 sidecar health: ${data.status} (model: ${data.model})`);
      return data;
    } catch (error: any) {
      this.isHealthy = false;
      this.logger.warn(
        `BGE-M3 sidecar unreachable at ${this.serviceUrl}: ${error.message}. ` +
        'Embeddings will fail until the sidecar is started.',
      );
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim() === '') {
      this.logger.warn('Empty text received; returning zero vector');
      return new Array(this.VECTOR_SIZE).fill(0);
    }

    // OpenAI fallback path
    if (this.usingOpenAiFallback && this.openaiClient) {
      return this.openaiEmbedSingle(text);
    }

    if (!this.isConfigured || !this.client) {
      throw new Error('No embedding provider configured (BGE_M3_SERVICE_URL or OPENAI_API_KEY required).');
    }

    return this.executeWithRetry('generateEmbedding', async () => {
      const { data } = await this.client.post('/embed', { text });
      const embedding = data.embedding;
      if (!Array.isArray(embedding) || embedding.length !== this.VECTOR_SIZE) {
        throw new Error(`BGE-M3 returned an invalid embedding dimension (${embedding?.length ?? 0}).`);
      }
      return embedding;
    });
  }

  private async openaiEmbedSingle(text: string): Promise<number[]> {
    const res = await this.openaiClient!.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000),
      dimensions: this.VECTOR_SIZE,
    });
    return res.data[0].embedding;
  }

  private async openaiEmbedBatch(texts: string[]): Promise<number[][]> {
    const BATCH = 96; // OpenAI limit per request
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH) {
      const slice = texts.slice(i, i + BATCH).map(t => t.slice(0, 8000));
      const res = await this.openaiClient!.embeddings.create({
        model: 'text-embedding-3-small',
        input: slice,
        dimensions: this.VECTOR_SIZE,
      });
      res.data.sort((a, b) => a.index - b.index);
      results.push(...res.data.map(d => d.embedding));
    }
    return results;
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) return [];

    // OpenAI fallback path
    if (this.usingOpenAiFallback && this.openaiClient) {
      return this.openaiEmbedBatch(texts);
    }

    if (!this.isConfigured || !this.client) {
      throw new Error('No embedding provider configured (BGE_M3_SERVICE_URL or OPENAI_API_KEY required).');
    }

    const indexMap: { origIdx: number; text: string }[] = [];
    const results: number[][] = new Array(texts.length);

    for (let i = 0; i < texts.length; i++) {
      if (!texts[i] || texts[i].trim() === '') {
        results[i] = new Array(this.VECTOR_SIZE).fill(0);
      } else {
        indexMap.push({ origIdx: i, text: texts[i] });
      }
    }

    if (indexMap.length === 0) return results;

    try {
      const SUB_BATCH = 16;  // smaller batches prevent per-request CPU timeout
      for (let start = 0; start < indexMap.length; start += SUB_BATCH) {
        const batch = indexMap.slice(start, start + SUB_BATCH);
        const batchTexts = batch.map((b) => b.text);

        const embeddings = await this.executeWithRetry(
          `generateBatchEmbeddings[${start}..${start + batch.length}]`,
          async () => {
            const { data } = await this.client.post('/embed-batch', { texts: batchTexts });
            return data.embeddings as number[][];
          },
        );

        if (!Array.isArray(embeddings) || embeddings.length !== batch.length) {
          throw new Error(`BGE-M3 returned ${embeddings?.length ?? 0} embeddings for ${batch.length} chunks.`);
        }

        for (let j = 0; j < batch.length; j++) {
          if (!Array.isArray(embeddings[j]) || embeddings[j].length !== this.VECTOR_SIZE) {
            throw new Error(`BGE-M3 returned an invalid embedding dimension for batch item ${j}.`);
          }
          results[batch[j].origIdx] = embeddings[j];
        }
      }
      return results;
    } catch (error: any) {
      throw new Error(
        `BGE-M3 embedding service unavailable or invalid at ${this.serviceUrl}. ` +
        `Start the LEGATRIXON BGE-M3 sidecar before ingestion. Root cause: ${error.message}`,
      );
    }
  }

  private async executeWithRetry<T>(opName: string, fn: () => Promise<T>): Promise<T> {
    let lastError: any;
    let delay = this.RETRY_DELAY_MS;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        const isTransient =
          error.code === 'ECONNREFUSED' ||
          error.code === 'ECONNRESET' ||
          error.code === 'ETIMEDOUT' ||
          error.response?.status >= 500;

        if (!isTransient || attempt === this.MAX_RETRIES) break;

        this.logger.warn(
          `[${opName}] Attempt ${attempt}/${this.MAX_RETRIES} failed: ${error.message}. Retrying in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }

    this.logger.error(`[${opName}] Failed after ${this.MAX_RETRIES} attempts: ${lastError.message}`);
    throw lastError;
  }
}



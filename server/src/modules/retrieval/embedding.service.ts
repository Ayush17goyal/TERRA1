import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  getProvider(): 'openai' | 'gemini' | 'mock' {
    const openAiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (openAiKey && openAiKey !== 'sk_openai_key_placeholder') {
      return 'openai';
    }
    if (geminiKey && geminiKey !== 'ai_gemini_key_placeholder') {
      return 'gemini';
    }
    return 'mock';
  }

  getVectorSize(): number {
    const provider = this.getProvider();
    if (provider === 'gemini') {
      return 768;
    }
    return 1536;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const provider = this.getProvider();
    
    if (provider === 'openai') {
      try {
        const response = await axios.post(
          'https://api.openai.com/v1/embeddings',
          {
            model: 'text-embedding-3-small',
            input: text,
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
          }
        );
        return response.data.data[0].embedding;
      } catch (error) {
        this.logger.error(`OpenAI Embedding generation failed: ${error.message}. Falling back to mock.`, error.stack);
      }
    }

    if (provider === 'gemini') {
      try {
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${process.env.GEMINI_API_KEY}`,
          {
            model: 'models/text-embedding-004',
            content: {
              parts: [{ text }],
            },
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
        return response.data.embedding.values;
      } catch (error) {
        this.logger.error(`Gemini Embedding generation failed: ${error.message}. Falling back to mock.`, error.stack);
      }
    }

    // Default or Fallback Mock Embeddings
    return this.generateMockEmbedding(text, this.getVectorSize());
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const provider = this.getProvider();
    const vectorSize = this.getVectorSize();

    if (provider === 'openai') {
      try {
        const response = await axios.post(
          'https://api.openai.com/v1/embeddings',
          {
            model: 'text-embedding-3-small',
            input: texts,
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
          }
        );
        return response.data.data.map((item: any) => item.embedding);
      } catch (error) {
        this.logger.error(`OpenAI Batch Embedding generation failed: ${error.message}. Falling back to mock.`, error.stack);
      }
    }

    if (provider === 'gemini') {
      try {
        const embeddings = await Promise.all(
          texts.map((text) => this.generateEmbedding(text))
        );
        return embeddings;
      } catch (error) {
        this.logger.error(`Gemini Batch Embedding generation failed: ${error.message}. Falling back to mock.`, error.stack);
      }
    }

    return texts.map((text) => this.generateMockEmbedding(text, vectorSize));
  }

  private generateMockEmbedding(text: string, size: number): number[] {
    // Generate deterministic hash code for the text
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }

    // Seed pseudo-random generator with hash code
    const random = this.getSeedRandom(hash);
    const vector: number[] = new Array(size);
    let sumSquares = 0;

    for (let i = 0; i < size; i++) {
      const val = random() * 2 - 1; // Values between -1 and 1
      vector[i] = val;
      sumSquares += val * val;
    }

    // Normalize to unit length
    const magnitude = Math.sqrt(sumSquares);
    for (let i = 0; i < size; i++) {
      vector[i] = vector[i] / (magnitude || 1);
    }

    return vector;
  }

  private getSeedRandom(seed: number) {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }
}

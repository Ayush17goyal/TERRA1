export interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
  generateBatchEmbeddings?(texts: string[]): Promise<number[][]>;
  getVectorSize(): number;
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model: string = 'text-embedding-3-small') {
    this.apiKey = apiKey || (typeof process !== 'undefined' ? process.env.OPENAI_API_KEY || '' : '');
    this.model = model;
  }

  getVectorSize(): number {
    return 1536;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.apiKey || this.apiKey === 'sk_openai_key_placeholder') {
      return this.generateMockEmbedding(text);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API responded with status ${response.status}`);
      }

      const result = await response.json();
      return result.data[0].embedding;
    } catch (error: any) {
      console.error(`[OpenAIEmbeddingProvider] Error: ${error.message}. Falling back to mock.`);
      return this.generateMockEmbedding(text);
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.apiKey || this.apiKey === 'sk_openai_key_placeholder') {
      return texts.map(text => this.generateMockEmbedding(text));
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: texts,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API responded with status ${response.status}`);
      }

      const result = await response.json();
      return result.data.map((item: any) => item.embedding);
    } catch (error: any) {
      console.error(`[OpenAIEmbeddingProvider] Batch Error: ${error.message}. Falling back to mocks.`);
      return texts.map(text => this.generateMockEmbedding(text));
    }
  }

  private generateMockEmbedding(text: string): number[] {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    
    const seedRandom = (seed: number) => {
      let s = seed;
      return () => {
        s = (s * 1664525 + 1013904223) % 4294967296;
        return s / 4294967296;
      };
    };

    const rand = seedRandom(hash);
    const size = this.getVectorSize();
    const vector = new Array(size);
    let sumSquares = 0;

    for (let i = 0; i < size; i++) {
      const val = rand() * 2 - 1;
      vector[i] = val;
      sumSquares += val * val;
    }

    const mag = Math.sqrt(sumSquares);
    for (let i = 0; i < size; i++) {
      vector[i] = vector[i] / (mag || 1);
    }

    return vector;
  }
}

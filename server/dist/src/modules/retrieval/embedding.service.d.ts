export declare class EmbeddingService {
    private readonly logger;
    getProvider(): 'openai' | 'gemini' | 'mock';
    getVectorSize(): number;
    generateEmbedding(text: string): Promise<number[]>;
    generateEmbeddings(texts: string[]): Promise<number[][]>;
    private generateMockEmbedding;
    private getSeedRandom;
}

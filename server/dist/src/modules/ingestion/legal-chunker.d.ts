export interface DocumentChunk {
    text: string;
    chunkIndex: number;
    totalChunks?: number;
    section?: string;
    metadata: Record<string, any>;
}
export interface ChunkerOptions {
    chunkSize?: number;
    chunkOverlap?: number;
}
export declare function chunkJudgment(text: string, opts?: ChunkerOptions): DocumentChunk[];
export declare function chunkBareAct(text: string, actName?: string, opts?: ChunkerOptions): DocumentChunk[];
export declare function chunkResearchPaper(text: string, opts?: ChunkerOptions): DocumentChunk[];
export declare function chunkGeneric(text: string, documentType: string, opts?: ChunkerOptions): DocumentChunk[];

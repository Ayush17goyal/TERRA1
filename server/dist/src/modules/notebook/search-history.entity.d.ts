export declare class NotebookSearchHistory {
    id: string;
    userId: string;
    query: string;
    mode: 'keyword' | 'vector' | 'hybrid';
    documentId: string;
    resultCount: number;
    warnings: string[];
    createdAt: Date;
}

export declare class NotebookChatMessage {
    id: string;
    userId: string;
    documentId: string;
    role: 'user' | 'assistant';
    text: string;
    citations: any;
    confidence: number;
    createdAt: Date;
}

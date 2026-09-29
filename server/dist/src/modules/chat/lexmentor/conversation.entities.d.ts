export declare class ConversationSession {
    id: string;
    userId: string;
    sessionId: string;
    title: string;
    metadata: Record<string, any>;
    lastActiveAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare class ConversationTurn {
    id: string;
    sessionId: string;
    role: 'user' | 'assistant';
    content: string;
    metadata: Record<string, any>;
    createdAt: Date;
}
export declare class PipelineAnalyticRecord {
    id: string;
    userId: string;
    sessionId: string;
    requestId: string;
    intent: string;
    provider: string;
    model: string;
    pipelineTotalMs: number;
    retrievedChunks: number;
    promptTokens: number;
    completionTokens: number;
    depth: string;
    stageTimings: Record<string, number>;
    createdAt: Date;
}

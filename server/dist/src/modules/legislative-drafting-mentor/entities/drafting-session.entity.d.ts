export type DraftingSessionStatus = 'in_progress' | 'completed';
export declare class DraftingSession {
    id: string;
    userId: string;
    topic: string;
    currentLessonIndex: number;
    completedLessons: number[];
    status: DraftingSessionStatus;
    academyState: Record<string, unknown>;
    stateVersion: number;
    lastActivityAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

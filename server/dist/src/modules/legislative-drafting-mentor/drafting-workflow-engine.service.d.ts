import { Repository } from 'typeorm';
import { DraftingSession } from './entities/drafting-session.entity';
import { DraftingLesson } from './lesson-catalog';
export interface DraftingSessionView {
    id: string;
    topic: string;
    status: DraftingSession['status'];
    currentLesson: DraftingLesson;
    completedLessons: number[];
    totalLessons: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare class DraftingWorkflowEngineService {
    private readonly sessions;
    constructor(sessions: Repository<DraftingSession>);
    createSession(userId: string, topic: string): Promise<DraftingSessionView>;
    listSessions(userId: string): Promise<DraftingSessionView[]>;
    resumeSession(userId: string, sessionId: string): Promise<DraftingSessionView>;
    advance(userId: string, sessionId: string): Promise<DraftingSessionView>;
    goBack(userId: string, sessionId: string): Promise<DraftingSessionView>;
    goToLesson(userId: string, sessionId: string, lessonIndex: number): Promise<DraftingSessionView>;
    getAcademyState(userId: string): Promise<{
        state: Record<string, unknown>;
        version: number;
        updatedAt: Date;
        lastActivityAt: Date;
    }>;
    syncAcademyState(userId: string, input: any): Promise<{
        conflict: boolean;
        state: Record<string, unknown>;
        version: number;
        updatedAt: Date;
    }>;
    private validateAcademyState;
    private getOrCreateAcademySession;
    private loadOwnedSession;
    private toView;
    getLessonCatalog(): DraftingLesson[];
}

import { Repository } from 'typeorm';
import { LiveDraftingSession } from './live-session.entity';
interface ScheduleDto {
    title: string;
    description?: string;
    instructor?: string;
    scheduledAt: string;
    endAt: string;
    meetLink: string;
    courseId?: string;
}
export declare class LiveSessionService {
    private readonly repo;
    constructor(repo: Repository<LiveDraftingSession>);
    private validateSchedule;
    scheduleLiveClass(dto: ScheduleDto): Promise<LiveDraftingSession>;
    updateLiveClass(id: string, dto: Partial<ScheduleDto>): Promise<LiveDraftingSession>;
    cancelSession(id: string): Promise<LiveDraftingSession>;
    deleteSession(id: string): Promise<{
        ok: boolean;
    }>;
    getSessionOrThrow(id: string): Promise<LiveDraftingSession>;
    private computeLiveState;
    private serializeForStudent;
    private serializeForAdmin;
    listSessions(): Promise<{
        id: string;
        title: string;
        description: string;
        instructor: string;
        scheduledAt: Date;
        endAt: Date;
        courseId: string;
        status: string;
        liveState: "cancelled" | "upcoming" | "live" | "ended";
        createdAt: Date;
    }[]>;
    adminListSessions(): Promise<{
        meetLink: string;
        id: string;
        title: string;
        description: string;
        instructor: string;
        scheduledAt: Date;
        endAt: Date;
        courseId: string;
        status: string;
        liveState: "cancelled" | "upcoming" | "live" | "ended";
        createdAt: Date;
    }[]>;
    getMeetLink(sessionId: string, _userId: string): Promise<{
        meetLink: string;
    }>;
}
export {};

import { LiveSessionService } from './live-session.service';
export declare class LiveSessionController {
    private readonly service;
    constructor(service: LiveSessionService);
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
    getMeetLink(id: string, req: any): Promise<{
        meetLink: string;
    }>;
    schedule(body: any): Promise<import("./live-session.entity").LiveDraftingSession>;
    update(id: string, body: any): Promise<import("./live-session.entity").LiveDraftingSession>;
    cancel(id: string): Promise<import("./live-session.entity").LiveDraftingSession>;
    remove(id: string): Promise<{
        ok: boolean;
    }>;
}

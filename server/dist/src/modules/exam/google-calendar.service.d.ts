import { GoogleOAuthToken } from './exam.entities';
import { Repository } from 'typeorm';
import { SupabaseService } from '../settings/supabase.service';
export declare class GoogleCalendarService {
    private readonly tokenRepository;
    private readonly supabaseService;
    private readonly logger;
    constructor(tokenRepository: Repository<GoogleOAuthToken>, supabaseService: SupabaseService);
    saveTokens(userId: string, accessToken: string, refreshToken: string, expiresSec: number): Promise<void>;
    getValidToken(userId: string): Promise<string | null>;
    private refreshAccessToken;
    createGoogleEvent(userId: string, event: {
        title: string;
        date: string;
        time: string;
        subject: string;
        description?: string;
        category?: string;
        priority?: string;
        moduleSource?: string;
        eventType?: string;
        reminderMinutes?: number;
    }): Promise<string | null>;
    updateGoogleEvent(userId: string, googleEventId: string, event: {
        title: string;
        date: string;
        time: string;
        subject: string;
        description?: string;
        category?: string;
        priority?: string;
        moduleSource?: string;
        eventType?: string;
    }): Promise<boolean>;
    deleteGoogleEvent(userId: string, googleEventId: string): Promise<boolean>;
}

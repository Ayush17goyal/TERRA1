import { Repository } from 'typeorm';
import { ConversationMessage } from './pipeline.types';
import { ConversationSession, ConversationTurn } from './conversation.entities';
export declare class ConversationMemoryService {
    private readonly sessionRepo;
    private readonly turnRepo;
    private readonly logger;
    private readonly localCache;
    private redisClient;
    constructor(sessionRepo: Repository<ConversationSession>, turnRepo: Repository<ConversationTurn>);
    load(userId: string, sessionId: string): Promise<ConversationMessage[]>;
    save(userId: string, sessionId: string, userMessage: string, assistantMessage: string, metadata?: Record<string, any>): Promise<void>;
    clear(userId: string, sessionId: string): Promise<void>;
    private cacheKey;
    private loadRaw;
    private setCache;
    private persistToDb;
    private deriveTitle;
    private initRedis;
    private redisGet;
    private redisSet;
    private redisDel;
    private scheduleLocalCacheEviction;
    private msg;
}

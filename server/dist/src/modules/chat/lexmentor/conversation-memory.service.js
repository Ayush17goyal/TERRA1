"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ConversationMemoryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationMemoryService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const conversation_entities_1 = require("./conversation.entities");
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_HISTORY_TURNS = 20;
const REDIS_KEY_PREFIX = 'lex:session:';
let ConversationMemoryService = ConversationMemoryService_1 = class ConversationMemoryService {
    constructor(sessionRepo, turnRepo) {
        this.sessionRepo = sessionRepo;
        this.turnRepo = turnRepo;
        this.logger = new common_1.Logger(ConversationMemoryService_1.name);
        this.localCache = new Map();
        this.redisClient = null;
        this.initRedis();
        this.scheduleLocalCacheEviction();
    }
    async load(userId, sessionId) {
        const key = this.cacheKey(userId, sessionId);
        const redisHit = await this.redisGet(key);
        if (redisHit) {
            this.logger.debug(`Memory: Redis hit for session ${sessionId}`);
            return redisHit.turns.slice(-MAX_HISTORY_TURNS);
        }
        const local = this.localCache.get(key);
        if (local && Date.now() - local.lastAccessedAt < SESSION_TTL_MS) {
            local.lastAccessedAt = Date.now();
            this.logger.debug(`Memory: local cache hit for session ${sessionId}`);
            return local.turns.slice(-MAX_HISTORY_TURNS);
        }
        try {
            const session = await this.sessionRepo.findOne({ where: { userId, sessionId } });
            if (session) {
                const dbTurns = await this.turnRepo.find({
                    where: { sessionId: session.id },
                    order: { createdAt: 'ASC' },
                    take: MAX_HISTORY_TURNS,
                });
                const messages = dbTurns.map((t) => ({
                    role: t.role,
                    content: t.content,
                    timestamp: t.createdAt,
                }));
                await this.setCache(key, messages);
                this.logger.debug(`Memory: DB load for session ${sessionId} (${messages.length} turns)`);
                return messages;
            }
        }
        catch (err) {
            this.logger.warn(`Memory: DB load failed for session ${sessionId}: ${this.msg(err)}`);
        }
        return [];
    }
    async save(userId, sessionId, userMessage, assistantMessage, metadata) {
        const key = this.cacheKey(userId, sessionId);
        const userTurn = { role: 'user', content: userMessage, timestamp: new Date() };
        const assistantTurn = { role: 'assistant', content: assistantMessage, timestamp: new Date() };
        const existing = await this.loadRaw(key);
        const updated = [...existing, userTurn, assistantTurn];
        await this.setCache(key, updated);
        this.persistToDb(userId, sessionId, userMessage, assistantMessage, metadata).catch((err) => this.logger.warn(`Memory: async DB persist failed: ${this.msg(err)}`));
    }
    async clear(userId, sessionId) {
        const key = this.cacheKey(userId, sessionId);
        this.localCache.delete(key);
        await this.redisDel(key);
        try {
            const session = await this.sessionRepo.findOne({ where: { userId, sessionId } });
            if (session) {
                await this.turnRepo.delete({ sessionId: session.id });
                await this.sessionRepo.delete(session.id);
            }
        }
        catch (err) {
            this.logger.warn(`Memory: DB clear failed: ${this.msg(err)}`);
        }
    }
    cacheKey(userId, sessionId) {
        return `${REDIS_KEY_PREFIX}${userId}:${sessionId}`;
    }
    async loadRaw(key) {
        const redisHit = await this.redisGet(key);
        if (redisHit)
            return redisHit.turns;
        const local = this.localCache.get(key);
        return local?.turns ?? [];
    }
    async setCache(key, turns) {
        const entry = { turns, lastAccessedAt: Date.now() };
        this.localCache.set(key, entry);
        await this.redisSet(key, entry);
    }
    async persistToDb(userId, sessionId, userMessage, assistantMessage, metadata) {
        let session = await this.sessionRepo.findOne({ where: { userId, sessionId } });
        if (!session) {
            session = this.sessionRepo.create({
                userId,
                sessionId,
                title: this.deriveTitle(userMessage),
                metadata: metadata ?? {},
            });
            session = await this.sessionRepo.save(session);
        }
        else {
            session.lastActiveAt = new Date();
            await this.sessionRepo.save(session);
        }
        await this.turnRepo.save([
            this.turnRepo.create({ sessionId: session.id, role: 'user', content: userMessage }),
            this.turnRepo.create({ sessionId: session.id, role: 'assistant', content: assistantMessage, metadata }),
        ]);
    }
    deriveTitle(message) {
        return message.slice(0, 80).replace(/\s+/g, ' ').trim();
    }
    initRedis() {
        try {
            const url = process.env.REDIS_URL || process.env.REDIS_HOST;
            if (!url)
                return;
            const redis = require('redis');
            const client = redis.createClient({ url: url.startsWith('redis') ? url : `redis://${url}` });
            client.on('error', (err) => {
                this.logger.warn(`Redis error (session cache degraded to local): ${this.msg(err)}`);
                this.redisClient = null;
            });
            client.connect().then(() => {
                this.redisClient = client;
                this.logger.log('ConversationMemory: Redis connected for session storage.');
            }).catch((err) => {
                this.logger.warn(`Redis connect failed — using local cache only: ${this.msg(err)}`);
            });
        }
        catch {
        }
    }
    async redisGet(key) {
        if (!this.redisClient)
            return null;
        try {
            const raw = await this.redisClient.get(key);
            return raw ? JSON.parse(raw) : null;
        }
        catch {
            return null;
        }
    }
    async redisSet(key, entry) {
        if (!this.redisClient)
            return;
        try {
            await this.redisClient.set(key, JSON.stringify(entry), { EX: Math.ceil(SESSION_TTL_MS / 1000) });
        }
        catch {
        }
    }
    async redisDel(key) {
        if (!this.redisClient)
            return;
        try {
            await this.redisClient.del(key);
        }
        catch {
        }
    }
    scheduleLocalCacheEviction() {
        setInterval(() => {
            const now = Date.now();
            for (const [key, entry] of this.localCache) {
                if (now - entry.lastAccessedAt > SESSION_TTL_MS) {
                    this.localCache.delete(key);
                }
            }
        }, 15 * 60 * 1000);
    }
    msg(err) {
        return err instanceof Error ? err.message : String(err);
    }
};
exports.ConversationMemoryService = ConversationMemoryService;
exports.ConversationMemoryService = ConversationMemoryService = ConversationMemoryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(conversation_entities_1.ConversationSession)),
    __param(1, (0, typeorm_1.InjectRepository)(conversation_entities_1.ConversationTurn)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], ConversationMemoryService);
//# sourceMappingURL=conversation-memory.service.js.map
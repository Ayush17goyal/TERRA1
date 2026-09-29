/**
 * Stage 1 — Conversation Memory
 *
 * Loads conversation history for a session and persists new turns.
 * Uses Redis as the hot store (in-memory LRU fallback when Redis is absent).
 * Every session is keyed as `lex:session:{userId}:{sessionId}`.
 * TTL is 24 hours — sufficient for daily work sessions.
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConversationMessage } from './pipeline.types';
import { ConversationSession, ConversationTurn } from './conversation.entities';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 h
const MAX_HISTORY_TURNS = 20; // last 20 turns included in context
const REDIS_KEY_PREFIX = 'lex:session:';

interface SessionEntry {
  turns: ConversationMessage[];
  lastAccessedAt: number;
}

@Injectable()
export class ConversationMemoryService {
  private readonly logger = new Logger(ConversationMemoryService.name);

  /**
   * In-process LRU-style fallback store when Redis is unavailable.
   * Key: `{userId}:{sessionId}` → SessionEntry
   */
  private readonly localCache = new Map<string, SessionEntry>();
  private redisClient: any = null;

  constructor(
    @InjectRepository(ConversationSession)
    private readonly sessionRepo: Repository<ConversationSession>,
    @InjectRepository(ConversationTurn)
    private readonly turnRepo: Repository<ConversationTurn>,
  ) {
    this.initRedis();
    this.scheduleLocalCacheEviction();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  /** Load the last N turns for this session. Returns [] for new sessions. */
  async load(userId: string, sessionId: string): Promise<ConversationMessage[]> {
    const key = this.cacheKey(userId, sessionId);

    // 1. Try Redis
    const redisHit = await this.redisGet(key);
    if (redisHit) {
      this.logger.debug(`Memory: Redis hit for session ${sessionId}`);
      return redisHit.turns.slice(-MAX_HISTORY_TURNS);
    }

    // 2. Try local cache
    const local = this.localCache.get(key);
    if (local && Date.now() - local.lastAccessedAt < SESSION_TTL_MS) {
      local.lastAccessedAt = Date.now();
      this.logger.debug(`Memory: local cache hit for session ${sessionId}`);
      return local.turns.slice(-MAX_HISTORY_TURNS);
    }

    // 3. Load from PostgreSQL (cold start / server restart)
    try {
      const session = await this.sessionRepo.findOne({ where: { userId, sessionId } });
      if (session) {
        const dbTurns = await this.turnRepo.find({
          where: { sessionId: session.id },
          order: { createdAt: 'ASC' },
          take: MAX_HISTORY_TURNS,
        });
        const messages: ConversationMessage[] = dbTurns.map((t) => ({
          role: t.role,
          content: t.content,
          timestamp: t.createdAt,
        }));
        // Warm the cache
        await this.setCache(key, messages);
        this.logger.debug(`Memory: DB load for session ${sessionId} (${messages.length} turns)`);
        return messages;
      }
    } catch (err) {
      this.logger.warn(`Memory: DB load failed for session ${sessionId}: ${this.msg(err)}`);
    }

    return [];
  }

  /** Append a user turn and an assistant turn, then persist. */
  async save(
    userId: string,
    sessionId: string,
    userMessage: string,
    assistantMessage: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const key = this.cacheKey(userId, sessionId);

    const userTurn: ConversationMessage = { role: 'user', content: userMessage, timestamp: new Date() };
    const assistantTurn: ConversationMessage = { role: 'assistant', content: assistantMessage, timestamp: new Date() };

    // Update in-memory / Redis cache first (non-blocking for the caller)
    const existing = await this.loadRaw(key);
    const updated = [...existing, userTurn, assistantTurn];
    await this.setCache(key, updated);

    // Persist to PostgreSQL asynchronously — never block the response stream
    this.persistToDb(userId, sessionId, userMessage, assistantMessage, metadata).catch((err) =>
      this.logger.warn(`Memory: async DB persist failed: ${this.msg(err)}`),
    );
  }

  /** Delete a session from all stores. */
  async clear(userId: string, sessionId: string): Promise<void> {
    const key = this.cacheKey(userId, sessionId);
    this.localCache.delete(key);
    await this.redisDel(key);
    try {
      const session = await this.sessionRepo.findOne({ where: { userId, sessionId } });
      if (session) {
        await this.turnRepo.delete({ sessionId: session.id });
        await this.sessionRepo.delete(session.id);
      }
    } catch (err) {
      this.logger.warn(`Memory: DB clear failed: ${this.msg(err)}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  private cacheKey(userId: string, sessionId: string): string {
    return `${REDIS_KEY_PREFIX}${userId}:${sessionId}`;
  }

  private async loadRaw(key: string): Promise<ConversationMessage[]> {
    const redisHit = await this.redisGet(key);
    if (redisHit) return redisHit.turns;
    const local = this.localCache.get(key);
    return local?.turns ?? [];
  }

  private async setCache(key: string, turns: ConversationMessage[]): Promise<void> {
    const entry: SessionEntry = { turns, lastAccessedAt: Date.now() };
    this.localCache.set(key, entry);
    await this.redisSet(key, entry);
  }

  private async persistToDb(
    userId: string,
    sessionId: string,
    userMessage: string,
    assistantMessage: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    let session = await this.sessionRepo.findOne({ where: { userId, sessionId } });
    if (!session) {
      session = this.sessionRepo.create({
        userId,
        sessionId,
        title: this.deriveTitle(userMessage),
        metadata: metadata ?? {},
      });
      session = await this.sessionRepo.save(session);
    } else {
      session.lastActiveAt = new Date();
      await this.sessionRepo.save(session);
    }

    await this.turnRepo.save([
      this.turnRepo.create({ sessionId: session.id, role: 'user', content: userMessage }),
      this.turnRepo.create({ sessionId: session.id, role: 'assistant', content: assistantMessage, metadata }),
    ]);
  }

  private deriveTitle(message: string): string {
    return message.slice(0, 80).replace(/\s+/g, ' ').trim();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Redis adapter (graceful no-op when Redis is unavailable)
  // ──────────────────────────────────────────────────────────────────────────

  private initRedis(): void {
    try {
      const url = process.env.REDIS_URL || process.env.REDIS_HOST;
      if (!url) return;
      // Dynamic import: only attempt if redis package is available
      const redis = require('redis'); // eslint-disable-line @typescript-eslint/no-var-requires
      const client = redis.createClient({ url: url.startsWith('redis') ? url : `redis://${url}` });
      client.on('error', (err: any) => {
        this.logger.warn(`Redis error (session cache degraded to local): ${this.msg(err)}`);
        this.redisClient = null;
      });
      client.connect().then(() => {
        this.redisClient = client;
        this.logger.log('ConversationMemory: Redis connected for session storage.');
      }).catch((err: any) => {
        this.logger.warn(`Redis connect failed — using local cache only: ${this.msg(err)}`);
      });
    } catch {
      // redis package not installed — silent degradation to local cache
    }
  }

  private async redisGet(key: string): Promise<SessionEntry | null> {
    if (!this.redisClient) return null;
    try {
      const raw = await this.redisClient.get(key);
      return raw ? (JSON.parse(raw) as SessionEntry) : null;
    } catch {
      return null;
    }
  }

  private async redisSet(key: string, entry: SessionEntry): Promise<void> {
    if (!this.redisClient) return;
    try {
      await this.redisClient.set(key, JSON.stringify(entry), { EX: Math.ceil(SESSION_TTL_MS / 1000) });
    } catch {
      // non-fatal
    }
  }

  private async redisDel(key: string): Promise<void> {
    if (!this.redisClient) return;
    try {
      await this.redisClient.del(key);
    } catch {
      // non-fatal
    }
  }

  private scheduleLocalCacheEviction(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.localCache) {
        if (now - entry.lastAccessedAt > SESSION_TTL_MS) {
          this.localCache.delete(key);
        }
      }
    }, 15 * 60 * 1000); // every 15 min
  }

  private msg(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}

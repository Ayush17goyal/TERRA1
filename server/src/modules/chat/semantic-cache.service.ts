import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { createClient } from 'redis';
import * as crypto from 'crypto';
import { BgeM3Provider } from '../retrieval/bge-m3.provider';
import { FallbackMetricsService } from './fallback-metrics.service';
import { LegalSource } from './legal-source.types';
import { ByokService } from '../settings/byok.service';

interface CachePayload {
  key: string;
  vector: number[];
  value: any;
  metadata?: Record<string, any>;
}

@Injectable()
export class SemanticCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(SemanticCacheService.name);
  private client: any;
  private isConnected = false;
  private fallbackMemoryCache = new Map<string, CachePayload>();

  constructor(
    private readonly bgeM3Provider: BgeM3Provider,
    private readonly metricsService: FallbackMetricsService,
    @Optional() private readonly byokService?: ByokService,
  ) {
    this.initRedis();
  }

  private async initRedis() {
    try {
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl) {
        this.logger.log('REDIS_URL is not configured. Using in-memory semantic cache fallback.');
        this.isConnected = false;
        return;
      }
      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            // Keep reconnecting quietly every 30 seconds after initial backoff
            if (retries > 10) {
              return 30000;
            }
            return Math.min(retries * 1000, 10000);
          },
        },
      });

      let lastErrorLogged = 0;
      this.client.on('error', (err: any) => {
        this.isConnected = false;
        const now = Date.now();
        if (now - lastErrorLogged > 30000) {
          this.logger.error(`Redis Client Error: ${err?.message || err || 'Connection failed/offline'}`);
          lastErrorLogged = now;
        }
      });

      this.client.on('connect', () => {
        this.logger.log('Redis client connected successfully.');
        this.isConnected = true;
      });

      await this.client.connect();
    } catch (err: any) {
      this.logger.error(`Failed to initialize Redis client: ${err?.message || err || 'Error'}. Using in-memory fallback.`);
      this.isConnected = false;
    }
  }

  async onModuleDestroy() {
    if (this.isConnected && this.client) {
      await this.client.disconnect();
    }
  }

  private getHash(query: string): string {
    return crypto.createHash('sha256').update(query.trim().toLowerCase()).digest('hex');
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return normA && normB ? dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
  }

  private getCostFactor(moduleName: string): number {
    switch (moduleName.toLowerCase()) {
      case 'lexmentor':
        return 0.0015; // Gemini Flash baseline
      case 'research':
        return 0.0075; // DeepSeek R1 baseline
      case 'judgment':
        return 0.0125; // Memorial Gen baseline
      case 'notebook':
      case 'studyforge':
        return 0.0035; // GPT-4o Mini baseline
      default:
        return 0.0015;
    }
  }

  async get(moduleName: string, queryText: string, userId?: string): Promise<any | null> {
    const hash = this.getHash(queryText);
    const key = `legatrixon:cache:${moduleName}:${hash}`;

    // 1. O(1) Exact Hash Check
    if (this.isConnected) {
      try {
        const raw = await this.client.get(key);
        if (raw) {
          this.logger.log(`Redis Cache exact hit for ${moduleName}: "${queryText.substring(0, 40)}..."`);
          const payload = JSON.parse(raw) as CachePayload;
          await this.recordTelemetry('exact', moduleName, userId);
          return payload.value;
        }
      } catch (err: any) {
        this.logger.warn(`Redis get failed: ${err.message}`);
      }
    } else {
      const cached = this.fallbackMemoryCache.get(key);
      if (cached) {
        this.logger.log(`Memory Cache exact hit for ${moduleName}: "${queryText.substring(0, 40)}..."`);
        this.metricsService.incrementHit(4); // increment level 4 (semantic/cache) hit
        if (userId && this.byokService) {
          this.byokService.incrementCacheHit(userId).catch(() => {});
        }
        return cached.value;
      }
    }

    // 2. O(N) Semantic Similarity Check
    let queryVector: number[] = [];
    try {
      if (this.bgeM3Provider.isAvailable()) {
        queryVector = await this.bgeM3Provider.generateEmbedding(queryText);
      }
    } catch (err: any) {
      this.logger.warn(`Failed to generate query embedding for cache check: ${err.message}`);
    }

    if (!queryVector || queryVector.length === 0) {
      await this.recordTelemetry('miss', moduleName, userId);
      return null;
    }

    let bestMatch: CachePayload | null = null;
    let highestSimilarity = 0;

    if (this.isConnected) {
      try {
        const registryKey = `legatrixon:cache:keys:${moduleName}`;
        const hashes = await this.client.sMembers(registryKey);
        
        if (hashes && hashes.length > 0) {
          const keys = hashes.map((h: string) => `legatrixon:cache:${moduleName}:${h}`);
          const rawItems = await this.client.mGet(keys);
          
          for (const raw of rawItems) {
            if (!raw) continue;
            const payload = JSON.parse(raw) as CachePayload;
            if (payload.vector && payload.vector.length > 0) {
              const similarity = this.cosineSimilarity(queryVector, payload.vector);
              if (similarity > highestSimilarity) {
                highestSimilarity = similarity;
                bestMatch = payload;
              }
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Redis registry fetch failed: ${err.message}`);
      }
    } else {
      // Memory cache similarity loop
      for (const payload of this.fallbackMemoryCache.values()) {
        if (payload.vector && payload.vector.length > 0) {
          const similarity = this.cosineSimilarity(queryVector, payload.vector);
          if (similarity > highestSimilarity) {
            highestSimilarity = similarity;
            bestMatch = payload;
          }
        }
      }
    }

    if (highestSimilarity >= 0.97 && bestMatch) {
      this.logger.log(`Semantic cache hit for ${moduleName} (Similarity: ${highestSimilarity.toFixed(4)})`);
      
      // Auto-populate exact key in Redis for future speed
      if (this.isConnected) {
        try {
          await this.client.setEx(key, 86400, JSON.stringify(bestMatch));
          await this.client.sAdd(`legatrixon:cache:keys:${moduleName}`, hash);
        } catch {}
      } else {
        this.fallbackMemoryCache.set(key, bestMatch);
      }

      await this.recordTelemetry('semantic', moduleName, userId);
      return bestMatch.value;
    }

    await this.recordTelemetry('miss', moduleName, userId);
    return null;
  }

  async set(moduleName: string, queryText: string, value: any, metadata: Record<string, any> = {}): Promise<void> {
    let queryVector: number[] = [];
    try {
      if (this.bgeM3Provider.isAvailable()) {
        queryVector = await this.bgeM3Provider.generateEmbedding(queryText);
      }
    } catch (err: any) {
      this.logger.warn(`Failed to generate embedding for cache storage: ${err.message}`);
    }

    const hash = this.getHash(queryText);
    const key = `legatrixon:cache:${moduleName}:${hash}`;
    const payload: CachePayload = {
      key: queryText,
      vector: queryVector,
      value,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    };

    if (this.isConnected) {
      try {
        const valueStr = JSON.stringify(payload);
        await this.client.setEx(key, 86400, valueStr); // 24 Hours TTL
        await this.client.sAdd(`legatrixon:cache:keys:${moduleName}`, hash);
      } catch (err: any) {
        this.logger.warn(`Redis set failed: ${err.message}`);
      }
    } else {
      // Enforce cache replacement policy (max 1000 items in memory)
      if (this.fallbackMemoryCache.size >= 1000) {
        const firstKey = this.fallbackMemoryCache.keys().next().value;
        if (firstKey) this.fallbackMemoryCache.delete(firstKey);
      }
      this.fallbackMemoryCache.set(key, payload);
    }
  }

  async getLegalReferences(queryText: string): Promise<LegalSource[] | null> {
    const hash = this.getHash(queryText);
    const key = `legatrixon:legalrefs:exact:${hash}`;

    if (this.isConnected) {
      try {
        const raw = await this.client.get(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
      } catch (err: any) {
        this.logger.warn(`Legal reference cache get failed: ${err.message}`);
        return null;
      }
    }

    const cached = this.fallbackMemoryCache.get(key);
    return cached && Array.isArray(cached.value) ? cached.value : null;
  }

  async setLegalReferences(queryText: string, sources: LegalSource[]): Promise<void> {
    if (!sources || sources.length === 0) return;

    const hash = this.getHash(queryText);
    const key = `legatrixon:legalrefs:exact:${hash}`;
    const ttlSeconds = 7 * 24 * 60 * 60;

    if (this.isConnected) {
      try {
        await this.client.setEx(key, ttlSeconds, JSON.stringify(sources));

        for (const source of sources) {
          if (!source.normalizedCitation) continue;
          const citationHash = this.getHash(source.normalizedCitation);
          await this.client.setEx(
            `legatrixon:legalrefs:citation:${citationHash}`,
            30 * 24 * 60 * 60,
            JSON.stringify(source),
          );
        }
      } catch (err: any) {
        this.logger.warn(`Legal reference cache set failed: ${err.message}`);
      }
      return;
    }

    if (this.fallbackMemoryCache.size >= 1000) {
      const firstKey = this.fallbackMemoryCache.keys().next().value;
      if (firstKey) this.fallbackMemoryCache.delete(firstKey);
    }

    this.fallbackMemoryCache.set(key, {
      key: queryText,
      vector: [],
      value: sources,
      metadata: {
        timestamp: new Date().toISOString(),
        kind: 'legal-references',
      },
    });
  }

  private async recordTelemetry(status: 'exact' | 'semantic' | 'miss', moduleName: string, userId?: string) {
    if (status === 'exact' || status === 'semantic') {
      this.metricsService.incrementHit(4); // increment level 4 (semantic/cache) hit
      if (userId && this.byokService) {
        this.byokService.incrementCacheHit(userId).catch(() => {});
      }
      if (this.isConnected) {
        try {
          await this.client.hIncrBy('legatrixon:analytics:cache', 'hits', 1);
          await this.client.hIncrBy('legatrixon:analytics:cache', 'apiCallsSaved', 1);
          
          const costFactor = this.getCostFactor(moduleName);
          const currentSavedStr = await this.client.hGet('legatrixon:analytics:cache', 'estimatedCostSaved') || '0';
          const newSaved = parseFloat(currentSavedStr) + costFactor;
          await this.client.hSet('legatrixon:analytics:cache', 'estimatedCostSaved', newSaved.toString());

          const flowKey = status === 'exact' ? 'exactHits' : 'semanticHits';
          await this.client.hIncrBy('legatrixon:analytics:pipeline', flowKey, 1);
        } catch {}
      }
    } else {
      if (this.isConnected) {
        try {
          await this.client.hIncrBy('legatrixon:analytics:cache', 'misses', 1);
        } catch {}
      }
    }
  }

  async recordPipelineMetrics(levelName: 'qdrantHits' | 'geminiHits' | 'gptHits' | 'deepseekHits' | 'friendlyHits') {
    if (this.isConnected) {
      try {
        await this.client.hIncrBy('legatrixon:analytics:pipeline', levelName, 1);
      } catch {}
    }
  }

  async isDocumentIngested(hash: string): Promise<boolean> {
    if (this.isConnected) {
      try {
        return await this.client.sIsMember('legatrixon:ingested:documents', hash);
      } catch (err: any) {
        this.logger.warn(`Redis sIsMember check failed: ${err.message}`);
      }
    }
    return this.fallbackMemoryCache.has(`document:${hash}`);
  }

  async recordIngestedDocument(hash: string): Promise<void> {
    if (this.isConnected) {
      try {
        await this.client.sAdd('legatrixon:ingested:documents', hash);
      } catch (err: any) {
        this.logger.warn(`Redis sAdd failed: ${err.message}`);
      }
    } else {
      this.fallbackMemoryCache.set(`document:${hash}`, {
        key: hash,
        vector: [],
        value: true,
      });
    }
  }

  async getAnalytics(): Promise<any> {
    if (this.isConnected) {
      try {
        const stats = await this.client.hGetAll('legatrixon:analytics:cache');
        const pipeline = await this.client.hGetAll('legatrixon:analytics:pipeline');
        return {
          hits: parseInt(stats.hits || '0', 10),
          misses: parseInt(stats.misses || '0', 10),
          apiCallsSaved: parseInt(stats.apiCallsSaved || '0', 10),
          estimatedCostSaved: parseFloat(stats.estimatedCostSaved || '0'),
          pipeline: {
            exactHits: parseInt(pipeline.exactHits || '0', 10),
            semanticHits: parseInt(pipeline.semanticHits || '0', 10),
            qdrantHits: parseInt(pipeline.qdrantHits || '0', 10),
            geminiHits: parseInt(pipeline.geminiHits || '0', 10),
            gptHits: parseInt(pipeline.gptHits || '0', 10),
            deepseekHits: parseInt(pipeline.deepseekHits || '0', 10),
            friendlyHits: parseInt(pipeline.friendlyHits || '0', 10),
          },
        };
      } catch (err: any) {
        this.logger.warn(`Failed to fetch Redis cache analytics: ${err.message}`);
      }
    }
    return {
      hits: 0,
      misses: 0,
      apiCallsSaved: 0,
      estimatedCostSaved: 0,
      pipeline: {
        exactHits: 0,
        semanticHits: 0,
        qdrantHits: 0,
        geminiHits: 0,
        gptHits: 0,
        deepseekHits: 0,
        friendlyHits: 0,
      },
    };
  }
}


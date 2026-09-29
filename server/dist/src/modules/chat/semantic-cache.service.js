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
var SemanticCacheService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticCacheService = void 0;
const common_1 = require("@nestjs/common");
const redis_1 = require("redis");
const crypto = require("crypto");
const bge_m3_provider_1 = require("../retrieval/bge-m3.provider");
const fallback_metrics_service_1 = require("./fallback-metrics.service");
const byok_service_1 = require("../settings/byok.service");
let SemanticCacheService = SemanticCacheService_1 = class SemanticCacheService {
    constructor(bgeM3Provider, metricsService, byokService) {
        this.bgeM3Provider = bgeM3Provider;
        this.metricsService = metricsService;
        this.byokService = byokService;
        this.logger = new common_1.Logger(SemanticCacheService_1.name);
        this.isConnected = false;
        this.fallbackMemoryCache = new Map();
        this.initRedis();
    }
    async initRedis() {
        try {
            const redisUrl = process.env.REDIS_URL;
            if (!redisUrl) {
                this.logger.log('REDIS_URL is not configured. Using in-memory semantic cache fallback.');
                this.isConnected = false;
                return;
            }
            this.client = (0, redis_1.createClient)({
                url: redisUrl,
                socket: {
                    reconnectStrategy: (retries) => {
                        if (retries > 10) {
                            return 30000;
                        }
                        return Math.min(retries * 1000, 10000);
                    },
                },
            });
            let lastErrorLogged = 0;
            this.client.on('error', (err) => {
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
        }
        catch (err) {
            this.logger.error(`Failed to initialize Redis client: ${err?.message || err || 'Error'}. Using in-memory fallback.`);
            this.isConnected = false;
        }
    }
    async onModuleDestroy() {
        if (this.isConnected && this.client) {
            await this.client.disconnect();
        }
    }
    getHash(query) {
        return crypto.createHash('sha256').update(query.trim().toLowerCase()).digest('hex');
    }
    cosineSimilarity(a, b) {
        if (!a || !b || a.length !== b.length)
            return 0;
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
    getCostFactor(moduleName) {
        switch (moduleName.toLowerCase()) {
            case 'lexmentor':
                return 0.0015;
            case 'research':
                return 0.0075;
            case 'judgment':
                return 0.0125;
            case 'notebook':
            case 'studyforge':
                return 0.0035;
            default:
                return 0.0015;
        }
    }
    async get(moduleName, queryText, userId) {
        const hash = this.getHash(queryText);
        const key = `legatrixon:cache:${moduleName}:${hash}`;
        if (this.isConnected) {
            try {
                const raw = await this.client.get(key);
                if (raw) {
                    this.logger.log(`Redis Cache exact hit for ${moduleName}: "${queryText.substring(0, 40)}..."`);
                    const payload = JSON.parse(raw);
                    await this.recordTelemetry('exact', moduleName, userId);
                    return payload.value;
                }
            }
            catch (err) {
                this.logger.warn(`Redis get failed: ${err.message}`);
            }
        }
        else {
            const cached = this.fallbackMemoryCache.get(key);
            if (cached) {
                this.logger.log(`Memory Cache exact hit for ${moduleName}: "${queryText.substring(0, 40)}..."`);
                this.metricsService.incrementHit(4);
                if (userId && this.byokService) {
                    this.byokService.incrementCacheHit(userId).catch(() => { });
                }
                return cached.value;
            }
        }
        let queryVector = [];
        try {
            if (this.bgeM3Provider.isAvailable()) {
                queryVector = await this.bgeM3Provider.generateEmbedding(queryText);
            }
        }
        catch (err) {
            this.logger.warn(`Failed to generate query embedding for cache check: ${err.message}`);
        }
        if (!queryVector || queryVector.length === 0) {
            await this.recordTelemetry('miss', moduleName, userId);
            return null;
        }
        let bestMatch = null;
        let highestSimilarity = 0;
        if (this.isConnected) {
            try {
                const registryKey = `legatrixon:cache:keys:${moduleName}`;
                const hashes = await this.client.sMembers(registryKey);
                if (hashes && hashes.length > 0) {
                    const keys = hashes.map((h) => `legatrixon:cache:${moduleName}:${h}`);
                    const rawItems = await this.client.mGet(keys);
                    for (const raw of rawItems) {
                        if (!raw)
                            continue;
                        const payload = JSON.parse(raw);
                        if (payload.vector && payload.vector.length > 0) {
                            const similarity = this.cosineSimilarity(queryVector, payload.vector);
                            if (similarity > highestSimilarity) {
                                highestSimilarity = similarity;
                                bestMatch = payload;
                            }
                        }
                    }
                }
            }
            catch (err) {
                this.logger.warn(`Redis registry fetch failed: ${err.message}`);
            }
        }
        else {
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
            if (this.isConnected) {
                try {
                    await this.client.setEx(key, 86400, JSON.stringify(bestMatch));
                    await this.client.sAdd(`legatrixon:cache:keys:${moduleName}`, hash);
                }
                catch { }
            }
            else {
                this.fallbackMemoryCache.set(key, bestMatch);
            }
            await this.recordTelemetry('semantic', moduleName, userId);
            return bestMatch.value;
        }
        await this.recordTelemetry('miss', moduleName, userId);
        return null;
    }
    async set(moduleName, queryText, value, metadata = {}) {
        let queryVector = [];
        try {
            if (this.bgeM3Provider.isAvailable()) {
                queryVector = await this.bgeM3Provider.generateEmbedding(queryText);
            }
        }
        catch (err) {
            this.logger.warn(`Failed to generate embedding for cache storage: ${err.message}`);
        }
        const hash = this.getHash(queryText);
        const key = `legatrixon:cache:${moduleName}:${hash}`;
        const payload = {
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
                await this.client.setEx(key, 86400, valueStr);
                await this.client.sAdd(`legatrixon:cache:keys:${moduleName}`, hash);
            }
            catch (err) {
                this.logger.warn(`Redis set failed: ${err.message}`);
            }
        }
        else {
            if (this.fallbackMemoryCache.size >= 1000) {
                const firstKey = this.fallbackMemoryCache.keys().next().value;
                if (firstKey)
                    this.fallbackMemoryCache.delete(firstKey);
            }
            this.fallbackMemoryCache.set(key, payload);
        }
    }
    async getLegalReferences(queryText) {
        const hash = this.getHash(queryText);
        const key = `legatrixon:legalrefs:exact:${hash}`;
        if (this.isConnected) {
            try {
                const raw = await this.client.get(key);
                if (!raw)
                    return null;
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed) ? parsed : null;
            }
            catch (err) {
                this.logger.warn(`Legal reference cache get failed: ${err.message}`);
                return null;
            }
        }
        const cached = this.fallbackMemoryCache.get(key);
        return cached && Array.isArray(cached.value) ? cached.value : null;
    }
    async setLegalReferences(queryText, sources) {
        if (!sources || sources.length === 0)
            return;
        const hash = this.getHash(queryText);
        const key = `legatrixon:legalrefs:exact:${hash}`;
        const ttlSeconds = 7 * 24 * 60 * 60;
        if (this.isConnected) {
            try {
                await this.client.setEx(key, ttlSeconds, JSON.stringify(sources));
                for (const source of sources) {
                    if (!source.normalizedCitation)
                        continue;
                    const citationHash = this.getHash(source.normalizedCitation);
                    await this.client.setEx(`legatrixon:legalrefs:citation:${citationHash}`, 30 * 24 * 60 * 60, JSON.stringify(source));
                }
            }
            catch (err) {
                this.logger.warn(`Legal reference cache set failed: ${err.message}`);
            }
            return;
        }
        if (this.fallbackMemoryCache.size >= 1000) {
            const firstKey = this.fallbackMemoryCache.keys().next().value;
            if (firstKey)
                this.fallbackMemoryCache.delete(firstKey);
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
    async recordTelemetry(status, moduleName, userId) {
        if (status === 'exact' || status === 'semantic') {
            this.metricsService.incrementHit(4);
            if (userId && this.byokService) {
                this.byokService.incrementCacheHit(userId).catch(() => { });
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
                }
                catch { }
            }
        }
        else {
            if (this.isConnected) {
                try {
                    await this.client.hIncrBy('legatrixon:analytics:cache', 'misses', 1);
                }
                catch { }
            }
        }
    }
    async recordPipelineMetrics(levelName) {
        if (this.isConnected) {
            try {
                await this.client.hIncrBy('legatrixon:analytics:pipeline', levelName, 1);
            }
            catch { }
        }
    }
    async isDocumentIngested(hash) {
        if (this.isConnected) {
            try {
                return await this.client.sIsMember('legatrixon:ingested:documents', hash);
            }
            catch (err) {
                this.logger.warn(`Redis sIsMember check failed: ${err.message}`);
            }
        }
        return this.fallbackMemoryCache.has(`document:${hash}`);
    }
    async recordIngestedDocument(hash) {
        if (this.isConnected) {
            try {
                await this.client.sAdd('legatrixon:ingested:documents', hash);
            }
            catch (err) {
                this.logger.warn(`Redis sAdd failed: ${err.message}`);
            }
        }
        else {
            this.fallbackMemoryCache.set(`document:${hash}`, {
                key: hash,
                vector: [],
                value: true,
            });
        }
    }
    async getAnalytics() {
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
            }
            catch (err) {
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
};
exports.SemanticCacheService = SemanticCacheService;
exports.SemanticCacheService = SemanticCacheService = SemanticCacheService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [bge_m3_provider_1.BgeM3Provider,
        fallback_metrics_service_1.FallbackMetricsService,
        byok_service_1.ByokService])
], SemanticCacheService);
//# sourceMappingURL=semantic-cache.service.js.map
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var BgeM3Provider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BgeM3Provider = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("axios");
const openai_1 = require("openai");
let BgeM3Provider = BgeM3Provider_1 = class BgeM3Provider {
    constructor() {
        this.logger = new common_1.Logger(BgeM3Provider_1.name);
        this.serviceUrl = '';
        this.isHealthy = false;
        this.isConfigured = false;
        this.usingOpenAiFallback = false;
        this.VECTOR_SIZE = 1024;
        this.MAX_RETRIES = 3;
        this.RETRY_DELAY_MS = 1000;
        this.EMBED_TIMEOUT_MS = 120_000;
    }
    onModuleInit() {
        this.serviceUrl = process.env.BGE_M3_SERVICE_URL || '';
        this.isConfigured = Boolean(this.serviceUrl);
        if (!this.isConfigured) {
            const openaiKey = process.env.OPENAI_API_KEY;
            if (openaiKey) {
                this.openaiClient = new openai_1.default({ apiKey: openaiKey });
                this.usingOpenAiFallback = true;
                this.isHealthy = true;
                this.logger.log('BGE_M3_SERVICE_URL not set — using OpenAI text-embedding-3-small (1024-dim) as fallback.');
            }
            else {
                this.logger.warn('BGE_M3_SERVICE_URL and OPENAI_API_KEY are both unset. Embeddings disabled.');
            }
            return;
        }
        this.logger.log(`Initializing BGE-M3 provider -> ${this.serviceUrl}`);
        this.client = axios_1.default.create({
            baseURL: this.serviceUrl,
            timeout: this.EMBED_TIMEOUT_MS,
            headers: { 'Content-Type': 'application/json' },
        });
        this.checkHealth().catch(() => { });
    }
    getVectorSize() {
        return this.VECTOR_SIZE;
    }
    isAvailable() {
        return this.isHealthy || this.usingOpenAiFallback;
    }
    async checkHealth() {
        if (!this.isConfigured || !this.client) {
            this.isHealthy = false;
            throw new Error('BGE_M3_SERVICE_URL is not configured.');
        }
        try {
            const { data } = await this.client.get('/health');
            this.isHealthy = data.status === 'healthy';
            this.logger.log(`BGE-M3 sidecar health: ${data.status} (model: ${data.model})`);
            return data;
        }
        catch (error) {
            this.isHealthy = false;
            this.logger.warn(`BGE-M3 sidecar unreachable at ${this.serviceUrl}: ${error.message}. ` +
                'Embeddings will fail until the sidecar is started.');
            throw error;
        }
    }
    async generateEmbedding(text) {
        if (!text || text.trim() === '') {
            this.logger.warn('Empty text received; returning zero vector');
            return new Array(this.VECTOR_SIZE).fill(0);
        }
        if (this.usingOpenAiFallback && this.openaiClient) {
            return this.openaiEmbedSingle(text);
        }
        if (!this.isConfigured || !this.client) {
            throw new Error('No embedding provider configured (BGE_M3_SERVICE_URL or OPENAI_API_KEY required).');
        }
        return this.executeWithRetry('generateEmbedding', async () => {
            const { data } = await this.client.post('/embed', { text });
            const embedding = data.embedding;
            if (!Array.isArray(embedding) || embedding.length !== this.VECTOR_SIZE) {
                throw new Error(`BGE-M3 returned an invalid embedding dimension (${embedding?.length ?? 0}).`);
            }
            return embedding;
        });
    }
    async openaiEmbedSingle(text) {
        const res = await this.openaiClient.embeddings.create({
            model: 'text-embedding-3-small',
            input: text.slice(0, 8000),
            dimensions: this.VECTOR_SIZE,
        });
        return res.data[0].embedding;
    }
    async openaiEmbedBatch(texts) {
        const BATCH = 96;
        const results = [];
        for (let i = 0; i < texts.length; i += BATCH) {
            const slice = texts.slice(i, i + BATCH).map(t => t.slice(0, 8000));
            const res = await this.openaiClient.embeddings.create({
                model: 'text-embedding-3-small',
                input: slice,
                dimensions: this.VECTOR_SIZE,
            });
            res.data.sort((a, b) => a.index - b.index);
            results.push(...res.data.map(d => d.embedding));
        }
        return results;
    }
    async generateBatchEmbeddings(texts) {
        if (!texts || texts.length === 0)
            return [];
        if (this.usingOpenAiFallback && this.openaiClient) {
            return this.openaiEmbedBatch(texts);
        }
        if (!this.isConfigured || !this.client) {
            throw new Error('No embedding provider configured (BGE_M3_SERVICE_URL or OPENAI_API_KEY required).');
        }
        const indexMap = [];
        const results = new Array(texts.length);
        for (let i = 0; i < texts.length; i++) {
            if (!texts[i] || texts[i].trim() === '') {
                results[i] = new Array(this.VECTOR_SIZE).fill(0);
            }
            else {
                indexMap.push({ origIdx: i, text: texts[i] });
            }
        }
        if (indexMap.length === 0)
            return results;
        try {
            const SUB_BATCH = 16;
            for (let start = 0; start < indexMap.length; start += SUB_BATCH) {
                const batch = indexMap.slice(start, start + SUB_BATCH);
                const batchTexts = batch.map((b) => b.text);
                const embeddings = await this.executeWithRetry(`generateBatchEmbeddings[${start}..${start + batch.length}]`, async () => {
                    const { data } = await this.client.post('/embed-batch', { texts: batchTexts });
                    return data.embeddings;
                });
                if (!Array.isArray(embeddings) || embeddings.length !== batch.length) {
                    throw new Error(`BGE-M3 returned ${embeddings?.length ?? 0} embeddings for ${batch.length} chunks.`);
                }
                for (let j = 0; j < batch.length; j++) {
                    if (!Array.isArray(embeddings[j]) || embeddings[j].length !== this.VECTOR_SIZE) {
                        throw new Error(`BGE-M3 returned an invalid embedding dimension for batch item ${j}.`);
                    }
                    results[batch[j].origIdx] = embeddings[j];
                }
            }
            return results;
        }
        catch (error) {
            throw new Error(`BGE-M3 embedding service unavailable or invalid at ${this.serviceUrl}. ` +
                `Start the LEGATRIXON BGE-M3 sidecar before ingestion. Root cause: ${error.message}`);
        }
    }
    async executeWithRetry(opName, fn) {
        let lastError;
        let delay = this.RETRY_DELAY_MS;
        for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
            try {
                return await fn();
            }
            catch (error) {
                lastError = error;
                const isTransient = error.code === 'ECONNREFUSED' ||
                    error.code === 'ECONNRESET' ||
                    error.code === 'ETIMEDOUT' ||
                    error.response?.status >= 500;
                if (!isTransient || attempt === this.MAX_RETRIES)
                    break;
                this.logger.warn(`[${opName}] Attempt ${attempt}/${this.MAX_RETRIES} failed: ${error.message}. Retrying in ${delay}ms...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
                delay *= 2;
            }
        }
        this.logger.error(`[${opName}] Failed after ${this.MAX_RETRIES} attempts: ${lastError.message}`);
        throw lastError;
    }
};
exports.BgeM3Provider = BgeM3Provider;
exports.BgeM3Provider = BgeM3Provider = BgeM3Provider_1 = __decorate([
    (0, common_1.Injectable)()
], BgeM3Provider);
//# sourceMappingURL=bge-m3.provider.js.map
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
var IngestionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestionService = void 0;
const common_1 = require("@nestjs/common");
const qdrant_service_1 = require("../retrieval/qdrant.service");
const bge_m3_provider_1 = require("../retrieval/bge-m3.provider");
const semantic_cache_service_1 = require("../chat/semantic-cache.service");
const legal_chunker_1 = require("./legal-chunker");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const COLLECTION_MAP = {
    constitution: 'constitution',
    bare_acts: 'bare_acts',
    supreme_court_cases: 'supreme_court_cases',
    high_court_cases: 'high_court_cases',
    research_papers: 'research_papers',
    user_documents: 'user_documents',
    bns: 'bns_bge',
    bnss: 'bnss_bge',
    act: 'acts_bge',
    judgment: 'judgments_bge',
    paper: 'research_papers_bge',
};
const BGE_M3_VECTOR_SIZE = 1024;
let IngestionService = IngestionService_1 = class IngestionService {
    constructor(qdrantService, bgeM3Provider, cacheService) {
        this.qdrantService = qdrantService;
        this.bgeM3Provider = bgeM3Provider;
        this.cacheService = cacheService;
        this.logger = new common_1.Logger(IngestionService_1.name);
        this.UPSERT_BATCH_SIZE = 50;
    }
    async getStatus() {
        let bgeM3Healthy = false;
        let bgeM3Model = null;
        let qdrantConnected = false;
        const collections = [];
        try {
            const health = await this.bgeM3Provider.checkHealth();
            bgeM3Healthy = health.status === 'healthy';
            bgeM3Model = health.model;
        }
        catch {
            this.logger.warn('BGE-M3 sidecar is not reachable');
        }
        try {
            const client = this.qdrantService.getClient();
            const response = await client.getCollections();
            qdrantConnected = true;
            for (const collectionName of Object.values(COLLECTION_MAP)) {
                const exists = response.collections.some((c) => c.name === collectionName);
                if (exists) {
                    try {
                        const info = await client.getCollection(collectionName);
                        collections.push({
                            name: collectionName,
                            pointCount: info.points_count || 0,
                            status: info.status,
                        });
                    }
                    catch {
                        collections.push({
                            name: collectionName,
                            pointCount: 0,
                            status: 'error',
                        });
                    }
                }
                else {
                    collections.push({
                        name: collectionName,
                        pointCount: 0,
                        status: 'not_created',
                    });
                }
            }
        }
        catch {
            this.logger.warn('Qdrant is not reachable');
        }
        return { bgeM3Healthy, bgeM3Model, qdrantConnected, collections };
    }
    async initializeCollections() {
        const client = this.qdrantService.getClient();
        const created = [];
        for (const [docType, collectionName] of Object.entries(COLLECTION_MAP)) {
            try {
                const response = await client.getCollections();
                const exists = response.collections.some((c) => c.name === collectionName);
                if (!exists) {
                    this.logger.log(`Creating BGE-M3 collection: ${collectionName} (${BGE_M3_VECTOR_SIZE}-dim, Cosine)`);
                    await client.createCollection(collectionName, {
                        vectors: {
                            size: BGE_M3_VECTOR_SIZE,
                            distance: 'Cosine',
                        },
                    });
                    await client.createPayloadIndex(collectionName, {
                        field_name: 'document_type',
                        field_schema: 'keyword',
                    });
                    await client.createPayloadIndex(collectionName, {
                        field_name: 'source_id',
                        field_schema: 'keyword',
                    });
                    created.push(collectionName);
                    this.logger.log(`Collection ${collectionName} created with payload indices.`);
                }
                else {
                    this.logger.log(`Collection ${collectionName} already exists.`);
                }
            }
            catch (error) {
                this.logger.error(`Failed to initialize collection ${collectionName}: ${error.message}`, error.stack);
            }
        }
        return created;
    }
    async ingestDocument(documentType, filePath, metadata = {}, chunkerOpts) {
        const startTime = Date.now();
        const fileName = path.basename(filePath);
        const documentId = metadata.documentId || this.generateDocumentId(filePath);
        const errors = [];
        this.logger.log(`[Ingest] Starting: type=${documentType}, file="${fileName}", id=${documentId}`);
        let rawText;
        try {
            rawText = await this.readFile(filePath);
        }
        catch (error) {
            const msg = `Failed to read file "${filePath}": ${error.message}`;
            this.logger.error(msg);
            return {
                documentId,
                documentType,
                fileName,
                chunksGenerated: 0,
                pointsUpserted: 0,
                errors: [msg],
                durationMs: Date.now() - startTime,
            };
        }
        if (!rawText || rawText.trim().length === 0) {
            return {
                documentId,
                documentType,
                fileName,
                chunksGenerated: 0,
                pointsUpserted: 0,
                errors: ['File is empty or unreadable'],
                durationMs: Date.now() - startTime,
            };
        }
        let fileHash;
        try {
            const fileBuffer = fs.readFileSync(filePath);
            fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
            const alreadyIngested = await this.cacheService.isDocumentIngested(fileHash);
            if (alreadyIngested) {
                this.logger.log(`[Ingest] Document "${fileName}" already ingested (SHA-256: ${fileHash}). Skipping.`);
                return {
                    documentId,
                    documentType,
                    fileName,
                    chunksGenerated: 0,
                    pointsUpserted: 0,
                    errors: [],
                    durationMs: Date.now() - startTime,
                };
            }
        }
        catch (err) {
            this.logger.warn(`Pre-ingestion hash check failed for "${fileName}": ${err.message}`);
        }
        const result = await this.ingestRawText(documentType, rawText, {
            ...metadata,
            documentId,
            fileName,
        }, chunkerOpts);
        if (result.errors.length === 0 && result.pointsUpserted > 0 && fileHash) {
            await this.cacheService.recordIngestedDocument(fileHash);
        }
        return result;
    }
    async ingestText(documentType, text, metadata = {}, chunkerOpts) {
        const documentId = metadata.documentId || this.generateDocumentId(text);
        const fileName = metadata.fileName || `inline_${documentType}_${documentId.substring(0, 8)}`;
        return this.ingestRawText(documentType, text, {
            ...metadata,
            documentId,
            fileName,
        }, chunkerOpts);
    }
    async ingestDirectory(documentType, dirPath, metadata = {}, chunkerOpts) {
        const startTime = Date.now();
        const results = [];
        let successful = 0;
        let failed = 0;
        await this.initializeCollections();
        let files;
        try {
            const entries = fs.readdirSync(dirPath);
            files = entries
                .filter((f) => {
                const ext = path.extname(f).toLowerCase();
                return ['.txt', '.pdf', '.json', '.md'].includes(ext);
            })
                .map((f) => path.join(dirPath, f));
        }
        catch (error) {
            this.logger.error(`Failed to read directory "${dirPath}": ${error.message}`);
            return {
                totalDocuments: 0,
                successful: 0,
                failed: 0,
                results: [],
                totalDurationMs: Date.now() - startTime,
            };
        }
        this.logger.log(`[BatchIngest] Found ${files.length} files in "${dirPath}" for type=${documentType}`);
        for (let i = 0; i < files.length; i++) {
            const filePath = files[i];
            this.logger.log(`[BatchIngest] Processing file ${i + 1}/${files.length}: ${path.basename(filePath)}`);
            try {
                const result = await this.ingestDocument(documentType, filePath, { ...metadata }, chunkerOpts);
                results.push(result);
                if (result.errors.length === 0) {
                    successful++;
                }
                else {
                    failed++;
                }
            }
            catch (error) {
                failed++;
                results.push({
                    documentId: this.generateDocumentId(filePath),
                    documentType,
                    fileName: path.basename(filePath),
                    chunksGenerated: 0,
                    pointsUpserted: 0,
                    errors: [error.message],
                    durationMs: 0,
                });
            }
        }
        const totalDurationMs = Date.now() - startTime;
        this.logger.log(`[BatchIngest] Complete: ${successful} succeeded, ${failed} failed, total ${totalDurationMs}ms`);
        return {
            totalDocuments: files.length,
            successful,
            failed,
            results,
            totalDurationMs,
        };
    }
    async ingestRawText(documentType, rawText, metadata, chunkerOpts) {
        const startTime = Date.now();
        const documentId = metadata.documentId;
        const fileName = metadata.fileName || 'inline';
        const errors = [];
        let chunks;
        try {
            chunks = this.chunkDocument(documentType, rawText, metadata, chunkerOpts);
            this.logger.log(`[Ingest] ${chunks.length} chunks generated from "${fileName}"`);
        }
        catch (error) {
            const msg = `Chunking failed for "${fileName}": ${error.message}`;
            this.logger.error(msg);
            return {
                documentId,
                documentType,
                fileName,
                chunksGenerated: 0,
                pointsUpserted: 0,
                errors: [msg],
                durationMs: Date.now() - startTime,
            };
        }
        const texts = chunks.map((c) => c.text);
        let embeddings;
        try {
            embeddings = await this.generateEmbeddingsViaBgeM3(texts);
            this.logger.log(`[Ingest] ${embeddings.length} BGE-M3 embeddings generated`);
        }
        catch (error) {
            const msg = `BGE-M3 embedding generation failed for "${fileName}": ${error.message}`;
            this.logger.error(msg);
            return {
                documentId,
                documentType,
                fileName,
                chunksGenerated: chunks.length,
                pointsUpserted: 0,
                errors: [msg],
                durationMs: Date.now() - startTime,
            };
        }
        const collection = COLLECTION_MAP[documentType];
        let pointsUpserted = 0;
        try {
            pointsUpserted = await this.upsertToQdrant(collection, documentId, chunks, embeddings, metadata);
            this.logger.log(`[Ingest] ${pointsUpserted} points upserted to "${collection}" for "${fileName}"`);
        }
        catch (error) {
            errors.push(`Qdrant upsert failed: ${error.message}`);
            this.logger.error(`[Ingest] Qdrant upsert failed: ${error.message}`, error.stack);
        }
        const durationMs = Date.now() - startTime;
        this.logger.log(`[Ingest] Completed "${fileName}" in ${durationMs}ms — ${pointsUpserted} points stored`);
        return {
            documentId,
            documentType,
            fileName,
            chunksGenerated: chunks.length,
            pointsUpserted,
            errors,
            durationMs,
        };
    }
    chunkDocument(type, text, metadata, opts) {
        switch (type) {
            case 'judgment':
            case 'supreme_court_cases':
            case 'high_court_cases':
                return (0, legal_chunker_1.chunkJudgment)(text, opts);
            case 'constitution':
                return (0, legal_chunker_1.chunkBareAct)(text, 'Constitution of India', opts);
            case 'bns':
                return (0, legal_chunker_1.chunkBareAct)(text, 'Bharatiya Nyaya Sanhita', opts);
            case 'bnss':
                return (0, legal_chunker_1.chunkBareAct)(text, 'Bharatiya Nagarik Suraksha Sanhita', opts);
            case 'act':
            case 'bare_acts':
                return (0, legal_chunker_1.chunkBareAct)(text, metadata.act_name || metadata.title || 'Bare Act', opts);
            case 'paper':
            case 'research_papers':
                return (0, legal_chunker_1.chunkResearchPaper)(text, opts);
            case 'user_documents':
                return (0, legal_chunker_1.chunkGeneric)(text, type, opts);
            default:
                return (0, legal_chunker_1.chunkGeneric)(text, type, opts);
        }
    }
    async readFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.pdf') {
            try {
                const pdfParse = require('pdf-parse');
                const buffer = fs.readFileSync(filePath);
                const data = await pdfParse(buffer);
                return data.text;
            }
            catch (error) {
                throw new Error(`PDF parsing failed for "${filePath}". Ensure pdf-parse is installed: npm i pdf-parse. Error: ${error.message}`);
            }
        }
        if (ext === '.json') {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(raw);
            return parsed.text || parsed.content || JSON.stringify(parsed);
        }
        return fs.readFileSync(filePath, 'utf-8');
    }
    async generateEmbeddingsViaBgeM3(texts) {
        try {
            return await this.bgeM3Provider.generateBatchEmbeddings(texts);
        }
        catch (batchError) {
            this.logger.warn(`BGE-M3 batch embedding failed: ${batchError.message}. Falling back to sequential.`);
        }
        const CONCURRENCY = 5;
        const results = new Array(texts.length);
        for (let i = 0; i < texts.length; i += CONCURRENCY) {
            const batch = texts.slice(i, i + CONCURRENCY);
            const promises = batch.map((text, j) => this.bgeM3Provider
                .generateEmbedding(text)
                .then((vec) => {
                results[i + j] = vec;
            }));
            await Promise.all(promises);
        }
        return results;
    }
    async upsertToQdrant(collection, documentId, chunks, embeddings, metadata) {
        const client = this.qdrantService.getClient();
        let upserted = 0;
        for (let i = 0; i < chunks.length; i += this.UPSERT_BATCH_SIZE) {
            const batchChunks = chunks.slice(i, i + this.UPSERT_BATCH_SIZE);
            const batchEmbeddings = embeddings.slice(i, i + this.UPSERT_BATCH_SIZE);
            const points = batchChunks.map((chunk, j) => ({
                id: this.generatePointId(documentId, chunk.chunkIndex),
                vector: batchEmbeddings[j],
                payload: {
                    text: chunk.text,
                    source_id: documentId,
                    document_type: metadata.documentType || null,
                    chunk_index: chunk.chunkIndex,
                    total_chunks: chunk.totalChunks,
                    section: chunk.section || null,
                    ...chunk.metadata,
                    ...metadata,
                    ingested_at: new Date().toISOString(),
                },
            }));
            await client.upsert(collection, {
                wait: true,
                points,
            });
            upserted += points.length;
        }
        return upserted;
    }
    generateDocumentId(input) {
        const hash = crypto.createHash('sha256').update(input).digest('hex');
        return hash.substring(0, 16);
    }
    generatePointId(documentId, chunkIndex) {
        const raw = `${documentId}::chunk_${chunkIndex}`;
        const hash = crypto.createHash('sha256').update(raw).digest('hex');
        return [
            hash.substring(0, 8),
            hash.substring(8, 12),
            hash.substring(12, 16),
            hash.substring(16, 20),
            hash.substring(20, 32),
        ].join('-');
    }
};
exports.IngestionService = IngestionService;
exports.IngestionService = IngestionService = IngestionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [qdrant_service_1.QdrantService,
        bge_m3_provider_1.BgeM3Provider,
        semantic_cache_service_1.SemanticCacheService])
], IngestionService);
//# sourceMappingURL=ingestion.service.js.map
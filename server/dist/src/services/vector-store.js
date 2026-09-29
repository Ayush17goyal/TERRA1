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
var VectorStoreService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorStoreService = void 0;
const common_1 = require("@nestjs/common");
const js_client_rest_1 = require("@qdrant/js-client-rest");
const embedding_service_1 = require("../modules/retrieval/embedding.service");
let VectorStoreService = VectorStoreService_1 = class VectorStoreService {
    constructor(embeddingService) {
        this.embeddingService = embeddingService;
        this.logger = new common_1.Logger(VectorStoreService_1.name);
        this.collectionName = 'user_documents';
        const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
        this.client = new js_client_rest_1.QdrantClient({ url: qdrantUrl });
    }
    async initializeCollection() {
        try {
            try {
                await this.client.getCollection(this.collectionName);
                this.logger.log(`Collection ${this.collectionName} already exists`);
                return;
            }
            catch {
            }
            const vectorSize = this.embeddingService.getVectorSize();
            await this.client.createCollection(this.collectionName, {
                vectors: {
                    size: vectorSize,
                    distance: 'Cosine',
                },
            });
            this.logger.log(`Created collection ${this.collectionName} with vector size ${vectorSize}`);
        }
        catch (error) {
            this.logger.error(`Failed to initialize collection: ${error.message}`);
            throw error;
        }
    }
    async storeChunks(documentId, chunks, metadata) {
        try {
            const texts = chunks.map(c => c.text);
            const embeddings = await this.embeddingService.generateEmbeddings(texts);
            if (embeddings.length !== chunks.length) {
                throw new Error(`Embedding count mismatch: ${embeddings.length} vs ${chunks.length}`);
            }
            const points = chunks.map((chunk, index) => ({
                id: this.generatePointId(documentId, chunk.chunkIndex),
                vector: embeddings[index] || new Array(this.embeddingService.getVectorSize()).fill(0),
                payload: {
                    document_id: documentId,
                    chunk_id: chunk.id,
                    document_type: metadata.document_type,
                    user_id: metadata.user_id,
                    source_file: metadata.source_file,
                    chunk_index: chunk.chunkIndex,
                    confidence: chunk.confidence,
                    quality_score: metadata.quality_score,
                    processed_at: new Date().toISOString(),
                    page_number: chunk.pageNumber || 1,
                },
            }));
            await this.client.upsert(this.collectionName, {
                points,
            });
            this.logger.log(`Stored ${points.length} vectors for document ${documentId} ` +
                `in collection ${this.collectionName}`);
            return {
                success: true,
                chunksStored: chunks.length,
                vectorsGenerated: embeddings.length,
            };
        }
        catch (error) {
            this.logger.error(`Failed to store chunks: ${error.message}`);
            return {
                success: false,
                chunksStored: 0,
                vectorsGenerated: 0,
                error: error.message,
            };
        }
    }
    async search(query, userId, limit = 10, scoreThreshold = 0.6) {
        try {
            const queryVector = await this.embeddingService.generateEmbedding(query);
            const results = await this.client.search(this.collectionName, {
                vector: queryVector,
                limit,
                filter: {
                    must: [
                        {
                            key: 'payload.user_id',
                            match: { value: userId },
                        },
                    ],
                },
            });
            return results
                .filter(r => r.score >= scoreThreshold)
                .map(r => ({
                chunk_id: r.payload?.chunk_id || '',
                document_id: r.payload?.document_id || '',
                similarity: r.score || 0,
                text: r.payload?.chunk_text || '',
                source_file: r.payload?.source_file || '',
            }));
        }
        catch (error) {
            this.logger.error(`Search failed: ${error.message}`);
            return [];
        }
    }
    async deleteDocument(documentId) {
        try {
            await this.client.delete(this.collectionName, {
                filter: {
                    must: [
                        {
                            key: 'payload.document_id',
                            match: { value: documentId },
                        },
                    ],
                },
            });
            this.logger.log(`Deleted vectors for document ${documentId}`);
            return { success: true };
        }
        catch (error) {
            this.logger.error(`Failed to delete document: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
    async getDocumentStats(documentId) {
        try {
            const results = await this.client.scroll(this.collectionName, {
                filter: {
                    must: [
                        {
                            key: 'payload.document_id',
                            match: { value: documentId },
                        },
                    ],
                },
                limit: 10000,
            });
            if (!results.points || results.points.length === 0) {
                return { vectorCount: 0, avgConfidence: 0, storageSize: 0 };
            }
            const confidences = results.points
                .map(p => p.payload?.confidence || 1)
                .filter(Boolean);
            const avgConfidence = confidences.length > 0
                ? confidences.reduce((a, b) => a + b, 0) / confidences.length
                : 0;
            return {
                vectorCount: results.points.length,
                avgConfidence,
                storageSize: results.points.length * 1536 * 4,
            };
        }
        catch (error) {
            this.logger.error(`Failed to get stats: ${error.message}`);
            return { vectorCount: 0, avgConfidence: 0, storageSize: 0 };
        }
    }
    generatePointId(documentId, chunkIndex) {
        const combined = `${documentId}_${chunkIndex}`;
        let hash = 0;
        for (let i = 0; i < combined.length; i++) {
            const char = combined.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash) % Number.MAX_SAFE_INTEGER;
    }
};
exports.VectorStoreService = VectorStoreService;
exports.VectorStoreService = VectorStoreService = VectorStoreService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [embedding_service_1.EmbeddingService])
], VectorStoreService);
//# sourceMappingURL=vector-store.js.map
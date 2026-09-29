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
var VectorSearchService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorSearchService = void 0;
const common_1 = require("@nestjs/common");
const qdrant_service_1 = require("./qdrant.service");
const bge_m3_provider_1 = require("./bge-m3.provider");
let VectorSearchService = VectorSearchService_1 = class VectorSearchService {
    constructor(qdrantService, bgeM3Provider) {
        this.qdrantService = qdrantService;
        this.bgeM3Provider = bgeM3Provider;
        this.logger = new common_1.Logger(VectorSearchService_1.name);
    }
    async upsertDocument(collection, id, text, metadata = {}) {
        try {
            this.logger.log(`Generating embedding for document ID ${id} in collection ${collection}`);
            const vector = await this.generateQdrantVector(text);
            const client = this.qdrantService.getClient();
            await client.upsert(collection, {
                wait: true,
                points: [
                    {
                        id,
                        vector,
                        payload: {
                            text,
                            ...metadata,
                        },
                    },
                ],
            });
            this.logger.log(`Document ID ${id} successfully upserted into collection ${collection}`);
        }
        catch (error) {
            this.logger.error(`Failed to upsert document ID ${id} in collection ${collection}: ${error.message}`, error.stack);
            throw error;
        }
    }
    async search(collection, query, limit = 5, filter) {
        try {
            this.logger.log(`Searching collection ${collection} for query: "${query}"`);
            const vector = await this.generateQdrantVector(query);
            const client = this.qdrantService.getClient();
            const results = await client.search(collection, {
                vector,
                limit,
                filter,
                with_payload: true,
            });
            return results.map((hit) => ({
                id: hit.id,
                score: hit.score,
                text: hit.payload?.text,
                metadata: { ...hit.payload },
            }));
        }
        catch (error) {
            this.logger.error(`Search failed in collection ${collection} for query "${query}": ${error.message}`, error.stack);
            throw error;
        }
    }
    async generateQdrantVector(text) {
        try {
            return await this.bgeM3Provider.generateEmbedding(text);
        }
        catch (error) {
            this.logger.warn('BGE-M3 vector generation failed. Using deterministic 1024-dim fallback.');
            return this.generateLocalEmbedding(text, this.bgeM3Provider.getVectorSize());
        }
    }
    generateLocalEmbedding(text, size) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = (hash << 5) - hash + text.charCodeAt(i);
            hash |= 0;
        }
        const random = () => {
            hash = (hash * 1664525 + 1013904223) % 4294967296;
            return hash / 4294967296;
        };
        const vector = new Array(size);
        let sumSquares = 0;
        for (let i = 0; i < size; i++) {
            const value = random() * 2 - 1;
            vector[i] = value;
            sumSquares += value * value;
        }
        const magnitude = Math.sqrt(sumSquares) || 1;
        return vector.map((value) => value / magnitude);
    }
    async deleteDocument(collection, id) {
        try {
            this.logger.log(`Deleting point ID ${id} from collection ${collection}`);
            const client = this.qdrantService.getClient();
            await client.delete(collection, {
                points: [id],
            });
            this.logger.log(`Point ID ${id} successfully deleted from collection ${collection}`);
        }
        catch (error) {
            this.logger.error(`Failed to delete point ID ${id} from collection ${collection}: ${error.message}`, error.stack);
            throw error;
        }
    }
    async clearCollection(collection) {
        try {
            this.logger.log(`Clearing all data from collection ${collection}`);
            const client = this.qdrantService.getClient();
            const vectorSize = this.bgeM3Provider.getVectorSize();
            await client.deleteCollection(collection);
            await client.createCollection(collection, {
                vectors: {
                    size: vectorSize,
                    distance: 'Cosine',
                },
            });
            this.logger.log(`Collection ${collection} successfully cleared.`);
        }
        catch (error) {
            this.logger.error(`Failed to clear collection ${collection}: ${error.message}`, error.stack);
            throw error;
        }
    }
};
exports.VectorSearchService = VectorSearchService;
exports.VectorSearchService = VectorSearchService = VectorSearchService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [qdrant_service_1.QdrantService,
        bge_m3_provider_1.BgeM3Provider])
], VectorSearchService);
//# sourceMappingURL=vector-search.service.js.map
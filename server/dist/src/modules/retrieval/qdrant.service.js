"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var QdrantService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QdrantService = void 0;
const common_1 = require("@nestjs/common");
const js_client_rest_1 = require("@qdrant/js-client-rest");
let QdrantService = QdrantService_1 = class QdrantService {
    constructor() {
        this.logger = new common_1.Logger(QdrantService_1.name);
    }
    onModuleInit() {
        const url = process.env.QDRANT_URL || 'http://localhost:6333';
        const rawApiKey = process.env.QDRANT_API_KEY || '';
        const isLocalHttp = /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url);
        const apiKey = rawApiKey && !isLocalHttp ? rawApiKey : undefined;
        this.logger.log(`Initializing Qdrant client → ${url}`);
        this.client = new js_client_rest_1.QdrantClient({ url, apiKey });
        this.initializeLegalCorpusCollection().catch(() => { });
    }
    getClient() {
        return this.client;
    }
    async initializeLegalCorpusCollection() {
        const name = QdrantService_1.COLLECTION;
        const size = QdrantService_1.VECTOR_SIZE;
        try {
            this.logger.log('Testing Qdrant connection...');
            await this.client.getCollections();
            this.logger.log('Successfully connected to Qdrant.');
        }
        catch (error) {
            this.logger.warn(`Could not connect to Qdrant at ${process.env.QDRANT_URL || 'http://localhost:6333'}. ` +
                `Vector search features will be unavailable. Error: ${error.message}`);
            return;
        }
        try {
            const response = await this.client.getCollections();
            const exists = response.collections.some((col) => col.name === name);
            if (!exists) {
                this.logger.log(`Creating unified collection: "${name}" (${size}-dim Cosine)`);
                await this.client.createCollection(name, {
                    vectors: { size, distance: 'Cosine' },
                });
                this.logger.log(`Collection "${name}" created.`);
            }
            else {
                this.logger.log(`Collection "${name}" already exists.`);
            }
            const keywordIndexes = [
                'act_id',
                'act_name',
                'category',
                'part',
                'chapter',
                'section',
                'subsection',
                'clause',
                'pdf_source',
                'embedding_version',
                'document_type',
                'jurisdiction',
                'year',
                'source',
            ];
            for (const field of keywordIndexes) {
                try {
                    await this.client.createPayloadIndex(name, {
                        field_name: field,
                        field_schema: 'keyword',
                    });
                }
                catch (_) {
                }
            }
            this.logger.log(`Payload indexes ensured for "${name}".`);
        }
        catch (error) {
            this.logger.error(`Failed to initialize collection "${name}": ${error.message}`, error.stack);
        }
    }
};
exports.QdrantService = QdrantService;
QdrantService.COLLECTION = 'legal_corpus';
QdrantService.VECTOR_SIZE = 1024;
exports.QdrantService = QdrantService = QdrantService_1 = __decorate([
    (0, common_1.Injectable)()
], QdrantService);
//# sourceMappingURL=qdrant.service.js.map
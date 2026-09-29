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
var KnowledgeEngineQueueService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeEngineQueueService = void 0;
const common_1 = require("@nestjs/common");
const knowledge_engine_service_1 = require("./knowledge-engine.service");
let KnowledgeEngineQueueService = KnowledgeEngineQueueService_1 = class KnowledgeEngineQueueService {
    constructor(knowledgeEngine) {
        this.knowledgeEngine = knowledgeEngine;
        this.logger = new common_1.Logger(KnowledgeEngineQueueService_1.name);
        this.maxConcurrent = Number(process.env.KNOWLEDGE_ENGINE_MAX_CONCURRENT_JOBS || 2);
        this.active = 0;
        this.pending = [];
        this.queued = new Set();
    }
    enqueue(documentId) {
        if (this.queued.has(documentId))
            return;
        this.queued.add(documentId);
        this.pending.push(documentId);
        this.drain();
    }
    drain() {
        while (this.active < this.maxConcurrent && this.pending.length > 0) {
            const documentId = this.pending.shift();
            this.active++;
            setImmediate(async () => {
                try {
                    await this.knowledgeEngine.buildFromDocument(documentId);
                }
                catch (error) {
                    this.logger.error(`Unhandled knowledge job error for ${documentId}: ${error.message}`, error.stack);
                }
                finally {
                    this.queued.delete(documentId);
                    this.active--;
                    this.drain();
                }
            });
        }
    }
};
exports.KnowledgeEngineQueueService = KnowledgeEngineQueueService;
exports.KnowledgeEngineQueueService = KnowledgeEngineQueueService = KnowledgeEngineQueueService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [knowledge_engine_service_1.KnowledgeEngineService])
], KnowledgeEngineQueueService);
//# sourceMappingURL=knowledge-engine-queue.service.js.map
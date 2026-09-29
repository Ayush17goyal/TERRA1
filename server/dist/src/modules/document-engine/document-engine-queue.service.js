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
var DocumentEngineQueueService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentEngineQueueService = void 0;
const common_1 = require("@nestjs/common");
const document_engine_pipeline_service_1 = require("./document-engine-pipeline.service");
let DocumentEngineQueueService = DocumentEngineQueueService_1 = class DocumentEngineQueueService {
    constructor(pipeline) {
        this.pipeline = pipeline;
        this.logger = new common_1.Logger(DocumentEngineQueueService_1.name);
        this.maxConcurrent = Number(process.env.DOCUMENT_ENGINE_MAX_CONCURRENT_JOBS || 3);
        this.active = 0;
        this.pending = [];
    }
    enqueue(documentId) {
        this.pending.push(documentId);
        this.drain();
    }
    drain() {
        while (this.active < this.maxConcurrent && this.pending.length > 0) {
            const documentId = this.pending.shift();
            this.active++;
            setImmediate(async () => {
                try {
                    await this.pipeline.run(documentId);
                }
                catch (error) {
                    this.logger.error(`Unhandled pipeline error for ${documentId}: ${error.message}`, error.stack);
                }
                finally {
                    this.active--;
                    this.drain();
                }
            });
        }
    }
};
exports.DocumentEngineQueueService = DocumentEngineQueueService;
exports.DocumentEngineQueueService = DocumentEngineQueueService = DocumentEngineQueueService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [document_engine_pipeline_service_1.DocumentEnginePipelineService])
], DocumentEngineQueueService);
//# sourceMappingURL=document-engine-queue.service.js.map
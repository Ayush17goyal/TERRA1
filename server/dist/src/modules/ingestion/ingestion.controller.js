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
var IngestionController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestionController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const ingestion_service_1 = require("./ingestion.service");
const corpus_scanner_service_1 = require("./corpus-scanner.service");
class IngestDocumentDto {
}
__decorate([
    (0, class_validator_1.IsIn)(['constitution', 'bare_acts', 'supreme_court_cases', 'high_court_cases', 'research_papers', 'user_documents', 'bns', 'bnss', 'act', 'judgment', 'paper']),
    __metadata("design:type", String)
], IngestDocumentDto.prototype, "documentType", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], IngestDocumentDto.prototype, "filePath", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], IngestDocumentDto.prototype, "metadata", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(200),
    (0, class_validator_1.Max)(4000),
    __metadata("design:type", Number)
], IngestDocumentDto.prototype, "chunkSize", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(1000),
    __metadata("design:type", Number)
], IngestDocumentDto.prototype, "chunkOverlap", void 0);
class IngestTextDto {
}
__decorate([
    (0, class_validator_1.IsIn)(['constitution', 'bare_acts', 'supreme_court_cases', 'high_court_cases', 'research_papers', 'user_documents', 'bns', 'bnss', 'act', 'judgment', 'paper']),
    __metadata("design:type", String)
], IngestTextDto.prototype, "documentType", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], IngestTextDto.prototype, "text", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], IngestTextDto.prototype, "metadata", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(200),
    (0, class_validator_1.Max)(4000),
    __metadata("design:type", Number)
], IngestTextDto.prototype, "chunkSize", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(1000),
    __metadata("design:type", Number)
], IngestTextDto.prototype, "chunkOverlap", void 0);
class IngestBatchDto {
}
__decorate([
    (0, class_validator_1.IsIn)(['constitution', 'bare_acts', 'supreme_court_cases', 'high_court_cases', 'research_papers', 'user_documents', 'bns', 'bnss', 'act', 'judgment', 'paper']),
    __metadata("design:type", String)
], IngestBatchDto.prototype, "documentType", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], IngestBatchDto.prototype, "directoryPath", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], IngestBatchDto.prototype, "metadata", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(200),
    (0, class_validator_1.Max)(4000),
    __metadata("design:type", Number)
], IngestBatchDto.prototype, "chunkSize", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(1000),
    __metadata("design:type", Number)
], IngestBatchDto.prototype, "chunkOverlap", void 0);
let IngestionController = IngestionController_1 = class IngestionController {
    constructor(ingestionService, corpusScannerService) {
        this.ingestionService = ingestionService;
        this.corpusScannerService = corpusScannerService;
        this.logger = new common_1.Logger(IngestionController_1.name);
    }
    async getStatus() {
        this.logger.log('GET /status — Checking pipeline health');
        const status = await this.ingestionService.getStatus();
        return {
            success: true,
            status,
        };
    }
    async initCollections() {
        this.logger.log('POST /init-collections — Creating BGE-M3 collections');
        const created = await this.ingestionService.initializeCollections();
        return {
            success: true,
            message: created.length > 0
                ? `Created collections: ${created.join(', ')}`
                : 'All collections already exist',
            created,
        };
    }
    async ingestDocument(dto) {
        this.logger.log(`POST /ingest — type=${dto.documentType}, file="${dto.filePath}"`);
        await this.ingestionService.initializeCollections();
        const result = await this.ingestionService.ingestDocument(dto.documentType, dto.filePath, dto.metadata || {}, {
            chunkSize: dto.chunkSize,
            chunkOverlap: dto.chunkOverlap,
        });
        return {
            success: result.errors.length === 0,
            result,
        };
    }
    async ingestText(dto) {
        this.logger.log(`POST /ingest-text — type=${dto.documentType}, textLength=${dto.text.length}`);
        await this.ingestionService.initializeCollections();
        const result = await this.ingestionService.ingestText(dto.documentType, dto.text, dto.metadata || {}, {
            chunkSize: dto.chunkSize,
            chunkOverlap: dto.chunkOverlap,
        });
        return {
            success: result.errors.length === 0,
            result,
        };
    }
    async ingestBatch(dto) {
        this.logger.log(`POST /ingest-batch — type=${dto.documentType}, dir="${dto.directoryPath}"`);
        const result = await this.ingestionService.ingestDirectory(dto.documentType, dto.directoryPath, dto.metadata || {}, {
            chunkSize: dto.chunkSize,
            chunkOverlap: dto.chunkOverlap,
        });
        return {
            success: result.failed === 0,
            result,
        };
    }
    async scanCorpus() {
        this.logger.log('POST /scan — Starting recursive corpus directory scan');
        const report = await this.corpusScannerService.scanCorpus();
        return {
            success: report.errors === 0,
            actsDiscovered: report.actsDiscovered,
            actsParsed: report.actsParsed,
            actsSkipped: report.actsSkipped,
            sectionsStored: report.sectionsStored,
            embeddingsGenerated: report.embeddingsGenerated,
            missingEmbeddings: report.missingEmbeddings,
            errors: report.errors,
            details: report.details,
        };
    }
};
exports.IngestionController = IngestionController;
__decorate([
    (0, common_1.Get)('status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], IngestionController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Post)('init-collections'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], IngestionController.prototype, "initCollections", null);
__decorate([
    (0, common_1.Post)('ingest'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [IngestDocumentDto]),
    __metadata("design:returntype", Promise)
], IngestionController.prototype, "ingestDocument", null);
__decorate([
    (0, common_1.Post)('ingest-text'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [IngestTextDto]),
    __metadata("design:returntype", Promise)
], IngestionController.prototype, "ingestText", null);
__decorate([
    (0, common_1.Post)('ingest-batch'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [IngestBatchDto]),
    __metadata("design:returntype", Promise)
], IngestionController.prototype, "ingestBatch", null);
__decorate([
    (0, common_1.Post)('scan'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], IngestionController.prototype, "scanCorpus", null);
exports.IngestionController = IngestionController = IngestionController_1 = __decorate([
    (0, common_1.Controller)('ingestion'),
    __metadata("design:paramtypes", [ingestion_service_1.IngestionService,
        corpus_scanner_service_1.CorpusScannerService])
], IngestionController);
//# sourceMappingURL=ingestion.controller.js.map
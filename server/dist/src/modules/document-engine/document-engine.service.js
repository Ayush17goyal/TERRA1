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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentEngineService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ingested_document_entity_1 = require("./entities/ingested-document.entity");
const document_knowledge_record_entity_1 = require("./entities/document-knowledge-record.entity");
const duplicate_detection_gate_1 = require("./gates/duplicate-detection.gate");
const document_engine_queue_service_1 = require("./document-engine-queue.service");
const document_engine_constants_1 = require("./document-engine.constants");
const virus_scanner_service_1 = require("../../hardening/security/virus-scanner.service");
let DocumentEngineService = class DocumentEngineService {
    constructor(documents, knowledgeRecords, duplicateGate, queue, virusScanner) {
        this.documents = documents;
        this.knowledgeRecords = knowledgeRecords;
        this.duplicateGate = duplicateGate;
        this.queue = queue;
        this.virusScanner = virusScanner;
    }
    async submit(userId, file, documentTypeHint) {
        if (!file) {
            throw new common_1.BadRequestException('Multipart file payload missing');
        }
        const scan = await this.virusScanner.scanBuffer(file.buffer, file.originalname);
        if (!scan.clean) {
            throw new common_1.BadRequestException(`Upload rejected by virus scanner (${scan.engine}): ${scan.details || 'unsafe file'}`);
        }
        if (file.size > document_engine_constants_1.MAX_UPLOAD_BYTES) {
            throw new common_1.BadRequestException(`File exceeds maximum upload size of ${document_engine_constants_1.MAX_UPLOAD_BYTES} bytes`);
        }
        const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
        if (!document_engine_constants_1.SUPPORTED_EXTENSIONS.includes(ext)) {
            throw new common_1.BadRequestException(`Format not supported. Please upload one of: ${document_engine_constants_1.SUPPORTED_EXTENSIONS.join(', ').toUpperCase()}.`);
        }
        const contentHash = this.duplicateGate.hash(file.buffer);
        const duplicate = await this.duplicateGate.check(userId, contentHash);
        if (!duplicate.passed) {
            return duplicate.existing;
        }
        const safeUserId = this.safePathSegment(userId);
        const uploadDir = path.resolve(process.cwd(), ...document_engine_constants_1.STORAGE_ROOT_SUBDIR, safeUserId);
        fs.mkdirSync(uploadDir, { recursive: true });
        const id = crypto.randomUUID();
        const safeFileName = this.safePathSegment(file.originalname);
        const storagePath = path.join(uploadDir, `${id}-${safeFileName}`);
        fs.writeFileSync(storagePath, file.buffer);
        const document = this.documents.create({
            id,
            userId,
            originalFilename: file.originalname,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            contentHash,
            status: 'queued',
            documentTypeHint: documentTypeHint || null,
            stageProgress: {},
            storagePath,
        });
        await this.documents.save(document);
        this.queue.enqueue(document.id);
        return document;
    }
    async listForUser(userId) {
        return this.documents.find({ where: { userId }, order: { createdAt: 'DESC' } });
    }
    async getStatus(userId, documentId) {
        const document = await this.documents.findOne({ where: { id: documentId, userId } });
        if (!document)
            throw new common_1.NotFoundException('Document not found');
        return document;
    }
    async getKnowledgeRecord(userId, documentId) {
        const document = await this.getStatus(userId, documentId);
        if (!['completed', 'needs_review', 'building_knowledge', 'knowledge_ready'].includes(document.status)) {
            throw new common_1.BadRequestException(`Document is not yet ready (status: ${document.status})`);
        }
        const record = await this.knowledgeRecords.findOne({ where: { documentId } });
        if (!record)
            throw new common_1.NotFoundException('Knowledge base record not found');
        return record;
    }
    safePathSegment(value) {
        return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 150);
    }
};
exports.DocumentEngineService = DocumentEngineService;
exports.DocumentEngineService = DocumentEngineService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ingested_document_entity_1.IngestedDocumentEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(document_knowledge_record_entity_1.DocumentKnowledgeRecordEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        duplicate_detection_gate_1.DuplicateDetectionGate,
        document_engine_queue_service_1.DocumentEngineQueueService,
        virus_scanner_service_1.VirusScannerService])
], DocumentEngineService);
//# sourceMappingURL=document-engine.service.js.map
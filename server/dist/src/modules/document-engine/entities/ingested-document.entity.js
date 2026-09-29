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
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestedDocumentEntity = void 0;
const typeorm_1 = require("typeorm");
const document_knowledge_record_entity_1 = require("./document-knowledge-record.entity");
let IngestedDocumentEntity = class IngestedDocumentEntity {
};
exports.IngestedDocumentEntity = IngestedDocumentEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], IngestedDocumentEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], IngestedDocumentEntity.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'original_filename' }),
    __metadata("design:type", String)
], IngestedDocumentEntity.prototype, "originalFilename", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mime_type' }),
    __metadata("design:type", String)
], IngestedDocumentEntity.prototype, "mimeType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'size_bytes' }),
    __metadata("design:type", Number)
], IngestedDocumentEntity.prototype, "sizeBytes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'storage_path' }),
    __metadata("design:type", String)
], IngestedDocumentEntity.prototype, "storagePath", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'content_hash' }),
    __metadata("design:type", String)
], IngestedDocumentEntity.prototype, "contentHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'queued' }),
    __metadata("design:type", String)
], IngestedDocumentEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', name: 'document_type', default: 'unknown' }),
    __metadata("design:type", String)
], IngestedDocumentEntity.prototype, "documentType", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, default: 'en' }),
    __metadata("design:type", String)
], IngestedDocumentEntity.prototype, "language", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ocr_used', default: false }),
    __metadata("design:type", Boolean)
], IngestedDocumentEntity.prototype, "ocrUsed", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', name: 'confidence_score', default: 0 }),
    __metadata("design:type", Number)
], IngestedDocumentEntity.prototype, "confidenceScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'needs_review', default: false }),
    __metadata("design:type", Boolean)
], IngestedDocumentEntity.prototype, "needsReview", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { name: 'review_reasons', nullable: true }),
    __metadata("design:type", Array)
], IngestedDocumentEntity.prototype, "reviewReasons", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'stage_progress', nullable: true }),
    __metadata("design:type", Object)
], IngestedDocumentEntity.prototype, "stageProgress", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'error_message', nullable: true }),
    __metadata("design:type", String)
], IngestedDocumentEntity.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'document_type_hint', nullable: true }),
    __metadata("design:type", String)
], IngestedDocumentEntity.prototype, "documentTypeHint", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => document_knowledge_record_entity_1.DocumentKnowledgeRecordEntity, (record) => record.document),
    __metadata("design:type", document_knowledge_record_entity_1.DocumentKnowledgeRecordEntity)
], IngestedDocumentEntity.prototype, "knowledgeRecord", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], IngestedDocumentEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], IngestedDocumentEntity.prototype, "updatedAt", void 0);
exports.IngestedDocumentEntity = IngestedDocumentEntity = __decorate([
    (0, typeorm_1.Entity)('document_engine_documents')
], IngestedDocumentEntity);
//# sourceMappingURL=ingested-document.entity.js.map
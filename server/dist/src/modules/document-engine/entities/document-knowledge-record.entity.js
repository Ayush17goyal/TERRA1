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
exports.DocumentKnowledgeRecordEntity = void 0;
const typeorm_1 = require("typeorm");
const ingested_document_entity_1 = require("./ingested-document.entity");
let DocumentKnowledgeRecordEntity = class DocumentKnowledgeRecordEntity {
};
exports.DocumentKnowledgeRecordEntity = DocumentKnowledgeRecordEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], DocumentKnowledgeRecordEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'document_id' }),
    __metadata("design:type", String)
], DocumentKnowledgeRecordEntity.prototype, "documentId", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => ingested_document_entity_1.IngestedDocumentEntity, (doc) => doc.knowledgeRecord, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'document_id' }),
    __metadata("design:type", ingested_document_entity_1.IngestedDocumentEntity)
], DocumentKnowledgeRecordEntity.prototype, "document", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json'),
    __metadata("design:type", Object)
], DocumentKnowledgeRecordEntity.prototype, "graph", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'retrievable_units' }),
    __metadata("design:type", Array)
], DocumentKnowledgeRecordEntity.prototype, "retrievableUnits", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { name: 'dominant_topics', nullable: true }),
    __metadata("design:type", Array)
], DocumentKnowledgeRecordEntity.prototype, "dominantTopics", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], DocumentKnowledgeRecordEntity.prototype, "createdAt", void 0);
exports.DocumentKnowledgeRecordEntity = DocumentKnowledgeRecordEntity = __decorate([
    (0, typeorm_1.Entity)('document_engine_knowledge_records')
], DocumentKnowledgeRecordEntity);
//# sourceMappingURL=document-knowledge-record.entity.js.map
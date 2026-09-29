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
exports.NotebookDocument = void 0;
const typeorm_1 = require("typeorm");
const chunk_entity_1 = require("./chunk.entity");
let NotebookDocument = class NotebookDocument {
};
exports.NotebookDocument = NotebookDocument;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], NotebookDocument.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], NotebookDocument.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], NotebookDocument.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], NotebookDocument.prototype, "size", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'Processing' }),
    __metadata("design:type", String)
], NotebookDocument.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'uploaded_at' }),
    __metadata("design:type", Date)
], NotebookDocument.prototype, "uploadedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0, name: 'word_count' }),
    __metadata("design:type", Number)
], NotebookDocument.prototype, "wordCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], NotebookDocument.prototype, "pages", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'User Notes', name: 'document_type' }),
    __metadata("design:type", String)
], NotebookDocument.prototype, "documentType", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0, name: 'clauses_count' }),
    __metadata("design:type", Number)
], NotebookDocument.prototype, "clausesCount", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true }),
    __metadata("design:type", Array)
], NotebookDocument.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true, name: 'legal_metadata' }),
    __metadata("design:type", Object)
], NotebookDocument.prototype, "legalMetadata", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true, name: 'study_forge' }),
    __metadata("design:type", Object)
], NotebookDocument.prototype, "studyForge", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], NotebookDocument.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'error_message', nullable: true }),
    __metadata("design:type", String)
], NotebookDocument.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'storage_path', nullable: true }),
    __metadata("design:type", String)
], NotebookDocument.prototype, "storagePath", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mime_type', nullable: true }),
    __metadata("design:type", String)
], NotebookDocument.prototype, "mimeType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'file_name', nullable: true }),
    __metadata("design:type", String)
], NotebookDocument.prototype, "fileName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'file_type', nullable: true }),
    __metadata("design:type", String)
], NotebookDocument.prototype, "fileType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'storage_url', nullable: true }),
    __metadata("design:type", String)
], NotebookDocument.prototype, "storageUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', name: 'extracted_text', nullable: true }),
    __metadata("design:type", String)
], NotebookDocument.prototype, "extractedText", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'embeddings_status', nullable: true }),
    __metadata("design:type", String)
], NotebookDocument.prototype, "embeddingsStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'qdrant_collection', nullable: true }),
    __metadata("design:type", String)
], NotebookDocument.prototype, "qdrantCollection", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'indexed_at', nullable: true }),
    __metadata("design:type", Date)
], NotebookDocument.prototype, "indexedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'chunk_count', default: 0 }),
    __metadata("design:type", Number)
], NotebookDocument.prototype, "chunkCount", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { name: 'topics_detected', nullable: true }),
    __metadata("design:type", Array)
], NotebookDocument.prototype, "topicsDetected", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => chunk_entity_1.DocumentChunk, (chunk) => chunk.document, { cascade: true }),
    __metadata("design:type", Array)
], NotebookDocument.prototype, "chunks", void 0);
exports.NotebookDocument = NotebookDocument = __decorate([
    (0, typeorm_1.Entity)('notebook_documents')
], NotebookDocument);
//# sourceMappingURL=notebook.entity.js.map
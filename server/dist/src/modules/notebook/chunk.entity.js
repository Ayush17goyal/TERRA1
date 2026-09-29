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
exports.DocumentChunk = void 0;
const typeorm_1 = require("typeorm");
const notebook_entity_1 = require("./notebook.entity");
let DocumentChunk = class DocumentChunk {
};
exports.DocumentChunk = DocumentChunk;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], DocumentChunk.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DocumentChunk.prototype, "documentId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'document_name', nullable: true }),
    __metadata("design:type", String)
], DocumentChunk.prototype, "documentName", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], DocumentChunk.prototype, "chunkIndex", void 0);
__decorate([
    (0, typeorm_1.Column)('text'),
    __metadata("design:type", String)
], DocumentChunk.prototype, "text", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 1 }),
    __metadata("design:type", Number)
], DocumentChunk.prototype, "pageNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DocumentChunk.prototype, "section", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], DocumentChunk.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => notebook_entity_1.NotebookDocument, (doc) => doc.chunks, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'documentId' }),
    __metadata("design:type", notebook_entity_1.NotebookDocument)
], DocumentChunk.prototype, "document", void 0);
exports.DocumentChunk = DocumentChunk = __decorate([
    (0, typeorm_1.Entity)('document_chunks')
], DocumentChunk);
//# sourceMappingURL=chunk.entity.js.map
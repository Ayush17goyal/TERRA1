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
exports.Draft = void 0;
const typeorm_1 = require("typeorm");
let Draft = class Draft {
};
exports.Draft = Draft;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Draft.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], Draft.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'file_name' }),
    __metadata("design:type", String)
], Draft.prototype, "fileName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'file_size' }),
    __metadata("design:type", Number)
], Draft.prototype, "fileSize", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mime_type' }),
    __metadata("design:type", String)
], Draft.prototype, "mimeType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'storage_path', nullable: true }),
    __metadata("design:type", String)
], Draft.prototype, "storagePath", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'pending' }),
    __metadata("design:type", String)
], Draft.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'extracted_at', nullable: true }),
    __metadata("design:type", Date)
], Draft.prototype, "extractedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reviewed_at', nullable: true }),
    __metadata("design:type", Date)
], Draft.prototype, "reviewedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Draft.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Draft.prototype, "updatedAt", void 0);
exports.Draft = Draft = __decorate([
    (0, typeorm_1.Entity)('draft_analyzer_drafts')
], Draft);
//# sourceMappingURL=draft.entity.js.map
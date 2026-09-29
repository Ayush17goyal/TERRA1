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
exports.ParsedProvisionEntity = void 0;
const typeorm_1 = require("typeorm");
let ParsedProvisionEntity = class ParsedProvisionEntity {
};
exports.ParsedProvisionEntity = ParsedProvisionEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ParsedProvisionEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'act_name' }),
    __metadata("design:type", String)
], ParsedProvisionEntity.prototype, "actName", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'act_id', default: '' }),
    __metadata("design:type", String)
], ParsedProvisionEntity.prototype, "actId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ParsedProvisionEntity.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ParsedProvisionEntity.prototype, "part", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ParsedProvisionEntity.prototype, "chapter", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ParsedProvisionEntity.prototype, "section", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ParsedProvisionEntity.prototype, "subsection", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ParsedProvisionEntity.prototype, "clause", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ParsedProvisionEntity.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], ParsedProvisionEntity.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array'),
    __metadata("design:type", Array)
], ParsedProvisionEntity.prototype, "keywords", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'content_hash', default: '' }),
    __metadata("design:type", String)
], ParsedProvisionEntity.prototype, "contentHash", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'pdf_source' }),
    __metadata("design:type", String)
], ParsedProvisionEntity.prototype, "pdfSource", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'embedding_synced', default: false }),
    __metadata("design:type", Boolean)
], ParsedProvisionEntity.prototype, "embeddingSynced", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'embedding_version', nullable: true }),
    __metadata("design:type", String)
], ParsedProvisionEntity.prototype, "embeddingVersion", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ParsedProvisionEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], ParsedProvisionEntity.prototype, "updatedAt", void 0);
exports.ParsedProvisionEntity = ParsedProvisionEntity = __decorate([
    (0, typeorm_1.Entity)('parsed_provisions')
], ParsedProvisionEntity);
//# sourceMappingURL=parsed-provision.entity.js.map
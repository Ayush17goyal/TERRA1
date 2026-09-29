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
exports.LegalActEntity = void 0;
const typeorm_1 = require("typeorm");
let LegalActEntity = class LegalActEntity {
};
exports.LegalActEntity = LegalActEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], LegalActEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'act_name' }),
    __metadata("design:type", String)
], LegalActEntity.prototype, "actName", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'act_id', default: '' }),
    __metadata("design:type", String)
], LegalActEntity.prototype, "actId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'short_name', default: '' }),
    __metadata("design:type", String)
], LegalActEntity.prototype, "shortName", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], LegalActEntity.prototype, "aliases", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], LegalActEntity.prototype, "year", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'active' }),
    __metadata("design:type", String)
], LegalActEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], LegalActEntity.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Index)({ unique: true }),
    (0, typeorm_1.Column)({ name: 'file_path' }),
    __metadata("design:type", String)
], LegalActEntity.prototype, "filePath", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'file_size_bytes' }),
    __metadata("design:type", Number)
], LegalActEntity.prototype, "fileSizeBytes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_modified_date' }),
    __metadata("design:type", Date)
], LegalActEntity.prototype, "lastModifiedDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pdf_hash', nullable: true }),
    __metadata("design:type", String)
], LegalActEntity.prototype, "pdfHash", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], LegalActEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], LegalActEntity.prototype, "updatedAt", void 0);
exports.LegalActEntity = LegalActEntity = __decorate([
    (0, typeorm_1.Entity)('legal_acts')
], LegalActEntity);
//# sourceMappingURL=legal-act.entity.js.map
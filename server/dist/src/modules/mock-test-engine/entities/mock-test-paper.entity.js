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
exports.MockTestPaperEntity = void 0;
const typeorm_1 = require("typeorm");
let MockTestPaperEntity = class MockTestPaperEntity {
};
exports.MockTestPaperEntity = MockTestPaperEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], MockTestPaperEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], MockTestPaperEntity.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], MockTestPaperEntity.prototype, "mode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], MockTestPaperEntity.prototype, "prompt", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json'),
    __metadata("design:type", Object)
], MockTestPaperEntity.prototype, "specification", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'coverage_snapshot', default: '{}' }),
    __metadata("design:type", Object)
], MockTestPaperEntity.prototype, "coverageSnapshot", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'assembly_sections', default: '[]' }),
    __metadata("design:type", Array)
], MockTestPaperEntity.prototype, "assemblySections", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { name: 'question_ids', nullable: true }),
    __metadata("design:type", Array)
], MockTestPaperEntity.prototype, "questionIds", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', name: 'total_marks', default: 0 }),
    __metadata("design:type", Number)
], MockTestPaperEntity.prototype, "totalMarks", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', name: 'duration_minutes', default: 0 }),
    __metadata("design:type", Number)
], MockTestPaperEntity.prototype, "durationMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'ready' }),
    __metadata("design:type", String)
], MockTestPaperEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true }),
    __metadata("design:type", Array)
], MockTestPaperEntity.prototype, "shortfalls", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', name: 'pdf_base64' }),
    __metadata("design:type", String)
], MockTestPaperEntity.prototype, "pdfBase64", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', name: 'generation_time_ms', default: 0 }),
    __metadata("design:type", Number)
], MockTestPaperEntity.prototype, "generationTimeMs", void 0);
__decorate([
    (0, typeorm_1.VersionColumn)(),
    __metadata("design:type", Number)
], MockTestPaperEntity.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], MockTestPaperEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], MockTestPaperEntity.prototype, "updatedAt", void 0);
exports.MockTestPaperEntity = MockTestPaperEntity = __decorate([
    (0, typeorm_1.Entity)('mock_test_papers'),
    (0, typeorm_1.Index)(['userId', 'createdAt']),
    (0, typeorm_1.Index)(['userId', 'mode', 'createdAt'])
], MockTestPaperEntity);
//# sourceMappingURL=mock-test-paper.entity.js.map
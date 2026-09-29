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
exports.PersonalExamLibraryEntity = void 0;
const typeorm_1 = require("typeorm");
let PersonalExamLibraryEntity = class PersonalExamLibraryEntity {
};
exports.PersonalExamLibraryEntity = PersonalExamLibraryEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], PersonalExamLibraryEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], PersonalExamLibraryEntity.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'building' }),
    __metadata("design:type", String)
], PersonalExamLibraryEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', name: 'current_stage', nullable: true }),
    __metadata("design:type", String)
], PersonalExamLibraryEntity.prototype, "currentStage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', name: 'topics_count', default: 0 }),
    __metadata("design:type", Number)
], PersonalExamLibraryEntity.prototype, "topicsCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', name: 'subtopics_count', default: 0 }),
    __metadata("design:type", Number)
], PersonalExamLibraryEntity.prototype, "subtopicsCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', name: 'definitions_count', default: 0 }),
    __metadata("design:type", Number)
], PersonalExamLibraryEntity.prototype, "definitionsCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', name: 'cases_count', default: 0 }),
    __metadata("design:type", Number)
], PersonalExamLibraryEntity.prototype, "casesCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', name: 'illustrations_count', default: 0 }),
    __metadata("design:type", Number)
], PersonalExamLibraryEntity.prototype, "illustrationsCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', name: 'coverage_score', default: 0 }),
    __metadata("design:type", Number)
], PersonalExamLibraryEntity.prototype, "coverageScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', name: 'confidence_score', default: 0 }),
    __metadata("design:type", Number)
], PersonalExamLibraryEntity.prototype, "confidenceScore", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { name: 'review_reasons', nullable: true }),
    __metadata("design:type", Array)
], PersonalExamLibraryEntity.prototype, "reviewReasons", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], PersonalExamLibraryEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], PersonalExamLibraryEntity.prototype, "updatedAt", void 0);
exports.PersonalExamLibraryEntity = PersonalExamLibraryEntity = __decorate([
    (0, typeorm_1.Entity)('personal_exam_libraries'),
    (0, typeorm_1.Index)(['userId'], { unique: true })
], PersonalExamLibraryEntity);
//# sourceMappingURL=personal-exam-library.entity.js.map
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
exports.ModelAnswerEntryEntity = void 0;
const typeorm_1 = require("typeorm");
let ModelAnswerEntryEntity = class ModelAnswerEntryEntity {
};
exports.ModelAnswerEntryEntity = ModelAnswerEntryEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ModelAnswerEntryEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], ModelAnswerEntryEntity.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'question_id' }),
    __metadata("design:type", String)
], ModelAnswerEntryEntity.prototype, "questionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tku_id' }),
    __metadata("design:type", String)
], ModelAnswerEntryEntity.prototype, "tkuId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], ModelAnswerEntryEntity.prototype, "question", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', name: 'mark_value' }),
    __metadata("design:type", Number)
], ModelAnswerEntryEntity.prototype, "markValue", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json'),
    __metadata("design:type", Array)
], ModelAnswerEntryEntity.prototype, "components", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'examiner_keywords' }),
    __metadata("design:type", Array)
], ModelAnswerEntryEntity.prototype, "examinerKeywords", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'bound_entity_refs' }),
    __metadata("design:type", Array)
], ModelAnswerEntryEntity.prototype, "boundEntityRefs", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'grounding_sources' }),
    __metadata("design:type", Array)
], ModelAnswerEntryEntity.prototype, "groundingSources", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', name: 'quality_score', default: 0 }),
    __metadata("design:type", Number)
], ModelAnswerEntryEntity.prototype, "qualityScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', name: 'validation_status' }),
    __metadata("design:type", String)
], ModelAnswerEntryEntity.prototype, "validationStatus", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { name: 'validation_reasons', nullable: true }),
    __metadata("design:type", Array)
], ModelAnswerEntryEntity.prototype, "validationReasons", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', name: 'source_question_version', default: 1 }),
    __metadata("design:type", Number)
], ModelAnswerEntryEntity.prototype, "sourceQuestionVersion", void 0);
__decorate([
    (0, typeorm_1.VersionColumn)(),
    __metadata("design:type", Number)
], ModelAnswerEntryEntity.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ModelAnswerEntryEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], ModelAnswerEntryEntity.prototype, "updatedAt", void 0);
exports.ModelAnswerEntryEntity = ModelAnswerEntryEntity = __decorate([
    (0, typeorm_1.Entity)('model_answer_entries'),
    (0, typeorm_1.Index)(['userId', 'questionId'], { unique: true }),
    (0, typeorm_1.Index)(['userId', 'validationStatus'])
], ModelAnswerEntryEntity);
//# sourceMappingURL=model-answer-entry.entity.js.map
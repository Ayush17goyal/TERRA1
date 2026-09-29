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
exports.QuestionBankEntryEntity = void 0;
const typeorm_1 = require("typeorm");
let QuestionBankEntryEntity = class QuestionBankEntryEntity {
};
exports.QuestionBankEntryEntity = QuestionBankEntryEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], QuestionBankEntryEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], QuestionBankEntryEntity.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'plan_id' }),
    __metadata("design:type", String)
], QuestionBankEntryEntity.prototype, "planId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'slot_id' }),
    __metadata("design:type", String)
], QuestionBankEntryEntity.prototype, "slotId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tku_id' }),
    __metadata("design:type", String)
], QuestionBankEntryEntity.prototype, "tkuId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], QuestionBankEntryEntity.prototype, "question", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', name: 'question_type' }),
    __metadata("design:type", String)
], QuestionBankEntryEntity.prototype, "questionType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], QuestionBankEntryEntity.prototype, "difficulty", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], QuestionBankEntryEntity.prototype, "topic", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], QuestionBankEntryEntity.prototype, "subtopic", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', name: 'mark_value' }),
    __metadata("design:type", Number)
], QuestionBankEntryEntity.prototype, "markValue", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json'),
    __metadata("design:type", Array)
], QuestionBankEntryEntity.prototype, "rubric", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'bound_entity_refs' }),
    __metadata("design:type", Array)
], QuestionBankEntryEntity.prototype, "boundEntityRefs", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'grounding_sources' }),
    __metadata("design:type", Array)
], QuestionBankEntryEntity.prototype, "groundingSources", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', name: 'quality_score', default: 0 }),
    __metadata("design:type", Number)
], QuestionBankEntryEntity.prototype, "qualityScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', name: 'model_answer', nullable: true, default: null }),
    __metadata("design:type", String)
], QuestionBankEntryEntity.prototype, "modelAnswer", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', name: 'validation_status' }),
    __metadata("design:type", String)
], QuestionBankEntryEntity.prototype, "validationStatus", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { name: 'validation_reasons', nullable: true }),
    __metadata("design:type", Array)
], QuestionBankEntryEntity.prototype, "validationReasons", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', name: 'source_tku_version', default: 1 }),
    __metadata("design:type", Number)
], QuestionBankEntryEntity.prototype, "sourceTkuVersion", void 0);
__decorate([
    (0, typeorm_1.VersionColumn)(),
    __metadata("design:type", Number)
], QuestionBankEntryEntity.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], QuestionBankEntryEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], QuestionBankEntryEntity.prototype, "updatedAt", void 0);
exports.QuestionBankEntryEntity = QuestionBankEntryEntity = __decorate([
    (0, typeorm_1.Entity)('question_bank_entries'),
    (0, typeorm_1.Index)(['userId', 'slotId'], { unique: true }),
    (0, typeorm_1.Index)(['userId', 'topic', 'subtopic', 'questionType', 'markValue', 'validationStatus'])
], QuestionBankEntryEntity);
//# sourceMappingURL=question-bank-entry.entity.js.map
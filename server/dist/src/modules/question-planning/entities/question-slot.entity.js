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
exports.QuestionSlotEntity = void 0;
const typeorm_1 = require("typeorm");
let QuestionSlotEntity = class QuestionSlotEntity {
};
exports.QuestionSlotEntity = QuestionSlotEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], QuestionSlotEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'plan_id' }),
    __metadata("design:type", String)
], QuestionSlotEntity.prototype, "planId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], QuestionSlotEntity.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tku_id' }),
    __metadata("design:type", String)
], QuestionSlotEntity.prototype, "tkuId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], QuestionSlotEntity.prototype, "topic", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], QuestionSlotEntity.prototype, "subtopic", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', name: 'question_type' }),
    __metadata("design:type", String)
], QuestionSlotEntity.prototype, "questionType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', name: 'mark_value' }),
    __metadata("design:type", Number)
], QuestionSlotEntity.prototype, "markValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', name: 'slot_index' }),
    __metadata("design:type", Number)
], QuestionSlotEntity.prototype, "slotIndex", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', name: 'eligibility_score', default: 0 }),
    __metadata("design:type", Number)
], QuestionSlotEntity.prototype, "eligibilityScore", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'required_entity_refs', default: '[]' }),
    __metadata("design:type", Array)
], QuestionSlotEntity.prototype, "requiredEntityRefs", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'requirements', default: '{}' }),
    __metadata("design:type", Object)
], QuestionSlotEntity.prototype, "requirements", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'planned' }),
    __metadata("design:type", String)
], QuestionSlotEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], QuestionSlotEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], QuestionSlotEntity.prototype, "updatedAt", void 0);
exports.QuestionSlotEntity = QuestionSlotEntity = __decorate([
    (0, typeorm_1.Entity)('question_slots'),
    (0, typeorm_1.Index)(['userId', 'tkuId', 'questionType', 'markValue']),
    (0, typeorm_1.Index)(['planId'])
], QuestionSlotEntity);
//# sourceMappingURL=question-slot.entity.js.map
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
exports.AnswerEvaluationAttemptEntity = void 0;
const typeorm_1 = require("typeorm");
let AnswerEvaluationAttemptEntity = class AnswerEvaluationAttemptEntity {
};
exports.AnswerEvaluationAttemptEntity = AnswerEvaluationAttemptEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AnswerEvaluationAttemptEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], AnswerEvaluationAttemptEntity.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'question_id', nullable: true }),
    __metadata("design:type", String)
], AnswerEvaluationAttemptEntity.prototype, "questionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'model_answer_id', nullable: true }),
    __metadata("design:type", String)
], AnswerEvaluationAttemptEntity.prototype, "modelAnswerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', name: 'student_answer' }),
    __metadata("design:type", String)
], AnswerEvaluationAttemptEntity.prototype, "studentAnswer", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], AnswerEvaluationAttemptEntity.prototype, "question", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json'),
    __metadata("design:type", Array)
], AnswerEvaluationAttemptEntity.prototype, "rubric", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'model_answer_components' }),
    __metadata("design:type", Array)
], AnswerEvaluationAttemptEntity.prototype, "modelAnswerComponents", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'examiner_keywords', default: '[]' }),
    __metadata("design:type", Array)
], AnswerEvaluationAttemptEntity.prototype, "examinerKeywords", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'criteria_scores' }),
    __metadata("design:type", Array)
], AnswerEvaluationAttemptEntity.prototype, "criteriaScores", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'dimension_marks' }),
    __metadata("design:type", Object)
], AnswerEvaluationAttemptEntity.prototype, "dimensionMarks", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', name: 'marks_awarded', default: 0 }),
    __metadata("design:type", Number)
], AnswerEvaluationAttemptEntity.prototype, "marksAwarded", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', name: 'max_marks', default: 0 }),
    __metadata("design:type", Number)
], AnswerEvaluationAttemptEntity.prototype, "maxMarks", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', default: 0 }),
    __metadata("design:type", Number)
], AnswerEvaluationAttemptEntity.prototype, "percentage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', name: 'time_spent_seconds', nullable: true }),
    __metadata("design:type", Number)
], AnswerEvaluationAttemptEntity.prototype, "timeSpentSeconds", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], AnswerEvaluationAttemptEntity.prototype, "strengths", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], AnswerEvaluationAttemptEntity.prototype, "weaknesses", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], AnswerEvaluationAttemptEntity.prototype, "suggestions", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'evaluated' }),
    __metadata("design:type", String)
], AnswerEvaluationAttemptEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.VersionColumn)(),
    __metadata("design:type", Number)
], AnswerEvaluationAttemptEntity.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], AnswerEvaluationAttemptEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], AnswerEvaluationAttemptEntity.prototype, "updatedAt", void 0);
exports.AnswerEvaluationAttemptEntity = AnswerEvaluationAttemptEntity = __decorate([
    (0, typeorm_1.Entity)('answer_evaluation_attempts'),
    (0, typeorm_1.Index)(['userId', 'createdAt']),
    (0, typeorm_1.Index)(['userId', 'questionId', 'createdAt'])
], AnswerEvaluationAttemptEntity);
//# sourceMappingURL=answer-evaluation-attempt.entity.js.map
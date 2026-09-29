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
exports.MockTestPaperQuestionEntity = void 0;
const typeorm_1 = require("typeorm");
let MockTestPaperQuestionEntity = class MockTestPaperQuestionEntity {
};
exports.MockTestPaperQuestionEntity = MockTestPaperQuestionEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], MockTestPaperQuestionEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'paper_id' }),
    __metadata("design:type", String)
], MockTestPaperQuestionEntity.prototype, "paperId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], MockTestPaperQuestionEntity.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'question_id' }),
    __metadata("design:type", String)
], MockTestPaperQuestionEntity.prototype, "questionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', name: 'question_number' }),
    __metadata("design:type", Number)
], MockTestPaperQuestionEntity.prototype, "questionNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'section_label' }),
    __metadata("design:type", String)
], MockTestPaperQuestionEntity.prototype, "sectionLabel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], MockTestPaperQuestionEntity.prototype, "question", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', name: 'question_type' }),
    __metadata("design:type", String)
], MockTestPaperQuestionEntity.prototype, "questionType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], MockTestPaperQuestionEntity.prototype, "difficulty", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MockTestPaperQuestionEntity.prototype, "topic", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MockTestPaperQuestionEntity.prototype, "subtopic", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', name: 'mark_value' }),
    __metadata("design:type", Number)
], MockTestPaperQuestionEntity.prototype, "markValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', name: 'quality_score', default: 0 }),
    __metadata("design:type", Number)
], MockTestPaperQuestionEntity.prototype, "qualityScore", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], MockTestPaperQuestionEntity.prototype, "createdAt", void 0);
exports.MockTestPaperQuestionEntity = MockTestPaperQuestionEntity = __decorate([
    (0, typeorm_1.Entity)('mock_test_paper_questions'),
    (0, typeorm_1.Index)(['paperId', 'questionNumber'], { unique: true }),
    (0, typeorm_1.Index)(['userId', 'questionId'])
], MockTestPaperQuestionEntity);
//# sourceMappingURL=mock-test-paper-question.entity.js.map
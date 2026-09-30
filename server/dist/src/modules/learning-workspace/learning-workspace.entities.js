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
exports.AiQuestionVaultItem = exports.AiLearningActivity = exports.AiFlashcardReview = exports.AiStudyKit = exports.AiMindMap = exports.AiMockTestAttempt = exports.AiMockTest = exports.AiLearningSource = void 0;
const typeorm_1 = require("typeorm");
let AiLearningSource = class AiLearningSource {
};
exports.AiLearningSource = AiLearningSource;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AiLearningSource.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], AiLearningSource.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AiLearningSource.prototype, "kind", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'Queued' }),
    __metadata("design:type", String)
], AiLearningSource.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'indexing_progress', default: 0 }),
    __metadata("design:type", Number)
], AiLearningSource.prototype, "indexingProgress", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'document_type', nullable: true }),
    __metadata("design:type", String)
], AiLearningSource.prototype, "documentType", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AiLearningSource.prototype, "subject", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AiLearningSource.prototype, "unit", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AiLearningSource.prototype, "topic", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AiLearningSource.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AiLearningSource.prototype, "url", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'storage_path', nullable: true }),
    __metadata("design:type", String)
], AiLearningSource.prototype, "storagePath", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mime_type', nullable: true }),
    __metadata("design:type", String)
], AiLearningSource.prototype, "mimeType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'text_length', default: 0 }),
    __metadata("design:type", Number)
], AiLearningSource.prototype, "textLength", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'vector_id', nullable: true }),
    __metadata("design:type", String)
], AiLearningSource.prototype, "vectorId", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '{}' }),
    __metadata("design:type", Object)
], AiLearningSource.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], AiLearningSource.prototype, "text", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], AiLearningSource.prototype, "createdAt", void 0);
exports.AiLearningSource = AiLearningSource = __decorate([
    (0, typeorm_1.Entity)('ai_learning_sources')
], AiLearningSource);
let AiMockTest = class AiMockTest {
};
exports.AiMockTest = AiMockTest;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AiMockTest.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], AiMockTest.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AiMockTest.prototype, "topic", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AiMockTest.prototype, "difficulty", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'question_type' }),
    __metadata("design:type", String)
], AiMockTest.prototype, "questionType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'question_count' }),
    __metadata("design:type", Number)
], AiMockTest.prototype, "questionCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'interactive' }),
    __metadata("design:type", String)
], AiMockTest.prototype, "mode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pdf_url', nullable: true }),
    __metadata("design:type", String)
], AiMockTest.prototype, "pdfUrl", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'source_ids', default: '[]' }),
    __metadata("design:type", Array)
], AiMockTest.prototype, "sourceIds", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], AiMockTest.prototype, "questions", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'score_report', default: '{}' }),
    __metadata("design:type", Object)
], AiMockTest.prototype, "scoreReport", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'weak_areas', default: '[]' }),
    __metadata("design:type", Array)
], AiMockTest.prototype, "weakAreas", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], AiMockTest.prototype, "createdAt", void 0);
exports.AiMockTest = AiMockTest = __decorate([
    (0, typeorm_1.Entity)('ai_mock_tests')
], AiMockTest);
let AiMockTestAttempt = class AiMockTestAttempt {
};
exports.AiMockTestAttempt = AiMockTestAttempt;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AiMockTestAttempt.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], AiMockTestAttempt.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mock_test_id' }),
    __metadata("design:type", String)
], AiMockTestAttempt.prototype, "mockTestId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], AiMockTestAttempt.prototype, "score", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], AiMockTestAttempt.prototype, "total", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], AiMockTestAttempt.prototype, "percentage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'time_taken', default: 0 }),
    __metadata("design:type", Number)
], AiMockTestAttempt.prototype, "timeTaken", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], AiMockTestAttempt.prototype, "accuracy", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '{}' }),
    __metadata("design:type", Object)
], AiMockTestAttempt.prototype, "answers", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'weak_areas', default: '[]' }),
    __metadata("design:type", Array)
], AiMockTestAttempt.prototype, "weakAreas", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], AiMockTestAttempt.prototype, "createdAt", void 0);
exports.AiMockTestAttempt = AiMockTestAttempt = __decorate([
    (0, typeorm_1.Entity)('ai_mock_test_attempts')
], AiMockTestAttempt);
let AiMindMap = class AiMindMap {
};
exports.AiMindMap = AiMindMap;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AiMindMap.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], AiMindMap.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AiMindMap.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'structure_type', default: 'Quick' }),
    __metadata("design:type", String)
], AiMindMap.prototype, "structureType", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'source_ids', default: '[]' }),
    __metadata("design:type", Array)
], AiMindMap.prototype, "sourceIds", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '{}' }),
    __metadata("design:type", Object)
], AiMindMap.prototype, "map", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], AiMindMap.prototype, "concepts", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'coverage_metrics', nullable: true }),
    __metadata("design:type", Object)
], AiMindMap.prototype, "coverageMetrics", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], AiMindMap.prototype, "createdAt", void 0);
exports.AiMindMap = AiMindMap = __decorate([
    (0, typeorm_1.Entity)('ai_mind_maps')
], AiMindMap);
let AiStudyKit = class AiStudyKit {
};
exports.AiStudyKit = AiStudyKit;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AiStudyKit.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], AiStudyKit.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AiStudyKit.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'source_ids', default: '[]' }),
    __metadata("design:type", Array)
], AiStudyKit.prototype, "sourceIds", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '{}' }),
    __metadata("design:type", Object)
], AiStudyKit.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], AiStudyKit.prototype, "createdAt", void 0);
exports.AiStudyKit = AiStudyKit = __decorate([
    (0, typeorm_1.Entity)('ai_study_kits')
], AiStudyKit);
let AiFlashcardReview = class AiFlashcardReview {
};
exports.AiFlashcardReview = AiFlashcardReview;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AiFlashcardReview.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], AiFlashcardReview.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'study_kit_id' }),
    __metadata("design:type", String)
], AiFlashcardReview.prototype, "studyKitId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'card_id' }),
    __metadata("design:type", String)
], AiFlashcardReview.prototype, "cardId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AiFlashcardReview.prototype, "rating", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Boolean)
], AiFlashcardReview.prototype, "correct", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AiFlashcardReview.prototype, "topic", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], AiFlashcardReview.prototype, "createdAt", void 0);
exports.AiFlashcardReview = AiFlashcardReview = __decorate([
    (0, typeorm_1.Entity)('ai_flashcard_reviews')
], AiFlashcardReview);
let AiLearningActivity = class AiLearningActivity {
};
exports.AiLearningActivity = AiLearningActivity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AiLearningActivity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], AiLearningActivity.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AiLearningActivity.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '{}' }),
    __metadata("design:type", Object)
], AiLearningActivity.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], AiLearningActivity.prototype, "createdAt", void 0);
exports.AiLearningActivity = AiLearningActivity = __decorate([
    (0, typeorm_1.Entity)('ai_learning_activity')
], AiLearningActivity);
let AiQuestionVaultItem = class AiQuestionVaultItem {
};
exports.AiQuestionVaultItem = AiQuestionVaultItem;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AiQuestionVaultItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', nullable: true }),
    __metadata("design:type", String)
], AiQuestionVaultItem.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_public', default: false }),
    __metadata("design:type", Boolean)
], AiQuestionVaultItem.prototype, "isPublic", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AiQuestionVaultItem.prototype, "subject", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AiQuestionVaultItem.prototype, "topic", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AiQuestionVaultItem.prototype, "subtopic", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'legal_domain', nullable: true }),
    __metadata("design:type", String)
], AiQuestionVaultItem.prototype, "legalDomain", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'question_type' }),
    __metadata("design:type", String)
], AiQuestionVaultItem.prototype, "questionType", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'Intermediate' }),
    __metadata("design:type", String)
], AiQuestionVaultItem.prototype, "difficulty", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 5 }),
    __metadata("design:type", Number)
], AiQuestionVaultItem.prototype, "marks", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'section_name', nullable: true }),
    __metadata("design:type", String)
], AiQuestionVaultItem.prototype, "sectionName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'exam_type', nullable: true }),
    __metadata("design:type", String)
], AiQuestionVaultItem.prototype, "examType", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AiQuestionVaultItem.prototype, "year", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'source_doc_name', nullable: true }),
    __metadata("design:type", String)
], AiQuestionVaultItem.prototype, "sourceDocName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'source_doc_no', nullable: true }),
    __metadata("design:type", String)
], AiQuestionVaultItem.prototype, "sourceDocNo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], AiQuestionVaultItem.prototype, "question", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Array)
], AiQuestionVaultItem.prototype, "options", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'model_answer', type: 'text', nullable: true }),
    __metadata("design:type", String)
], AiQuestionVaultItem.prototype, "modelAnswer", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], AiQuestionVaultItem.prototype, "rubric", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'legal_ref', nullable: true }),
    __metadata("design:type", String)
], AiQuestionVaultItem.prototype, "legalRef", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'usage_count', default: 0 }),
    __metadata("design:type", Number)
], AiQuestionVaultItem.prototype, "usageCount", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '{}' }),
    __metadata("design:type", Object)
], AiQuestionVaultItem.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], AiQuestionVaultItem.prototype, "createdAt", void 0);
exports.AiQuestionVaultItem = AiQuestionVaultItem = __decorate([
    (0, typeorm_1.Entity)('ai_question_vault')
], AiQuestionVaultItem);
//# sourceMappingURL=learning-workspace.entities.js.map
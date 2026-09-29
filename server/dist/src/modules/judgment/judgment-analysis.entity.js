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
exports.JudgmentAnalysis = void 0;
const typeorm_1 = require("typeorm");
let JudgmentAnalysis = class JudgmentAnalysis {
};
exports.JudgmentAnalysis = JudgmentAnalysis;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], JudgmentAnalysis.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'document_id' }),
    __metadata("design:type", String)
], JudgmentAnalysis.prototype, "documentId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], JudgmentAnalysis.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], JudgmentAnalysis.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], JudgmentAnalysis.prototype, "citation", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], JudgmentAnalysis.prototype, "court", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], JudgmentAnalysis.prototype, "bench", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'date_of_judgment', nullable: true }),
    __metadata("design:type", String)
], JudgmentAnalysis.prototype, "dateOfJudgment", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], JudgmentAnalysis.prototype, "judges", void 0);
__decorate([
    (0, typeorm_1.Column)('text'),
    __metadata("design:type", String)
], JudgmentAnalysis.prototype, "facts", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], JudgmentAnalysis.prototype, "issues", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'arguments_petitioner', default: '[]' }),
    __metadata("design:type", Array)
], JudgmentAnalysis.prototype, "argumentsPetitioner", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'arguments_respondent', default: '[]' }),
    __metadata("design:type", Array)
], JudgmentAnalysis.prototype, "argumentsRespondent", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], JudgmentAnalysis.prototype, "statutes", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], JudgmentAnalysis.prototype, "precedents", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { name: 'ratio_decidendi' }),
    __metadata("design:type", String)
], JudgmentAnalysis.prototype, "ratioDecidendi", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { name: 'obiter_dicta', nullable: true }),
    __metadata("design:type", String)
], JudgmentAnalysis.prototype, "obiterDicta", void 0);
__decorate([
    (0, typeorm_1.Column)('text'),
    __metadata("design:type", String)
], JudgmentAnalysis.prototype, "holding", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { name: 'final_verdict' }),
    __metadata("design:type", String)
], JudgmentAnalysis.prototype, "finalVerdict", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], JudgmentAnalysis.prototype, "timeline", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'citation_network', default: '[]' }),
    __metadata("design:type", Array)
], JudgmentAnalysis.prototype, "citationNetwork", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', name: 'exam_relevance_score', default: 0 }),
    __metadata("design:type", Number)
], JudgmentAnalysis.prototype, "examRelevanceScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', name: 'landmark_impact_score', default: 0 }),
    __metadata("design:type", Number)
], JudgmentAnalysis.prototype, "landmarkImpactScore", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'source_chunk_refs', nullable: true }),
    __metadata("design:type", Array)
], JudgmentAnalysis.prototype, "sourceChunkRefs", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { name: 'revision_notes', nullable: true }),
    __metadata("design:type", String)
], JudgmentAnalysis.prototype, "revisionNotes", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'moot_court_kit', nullable: true }),
    __metadata("design:type", Object)
], JudgmentAnalysis.prototype, "mootCourtKit", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], JudgmentAnalysis.prototype, "createdAt", void 0);
exports.JudgmentAnalysis = JudgmentAnalysis = __decorate([
    (0, typeorm_1.Entity)('judgment_analyses')
], JudgmentAnalysis);
//# sourceMappingURL=judgment-analysis.entity.js.map
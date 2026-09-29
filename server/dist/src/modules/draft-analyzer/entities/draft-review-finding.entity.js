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
exports.DraftReviewFinding = void 0;
const typeorm_1 = require("typeorm");
const draft_entity_1 = require("./draft.entity");
let DraftReviewFinding = class DraftReviewFinding {
};
exports.DraftReviewFinding = DraftReviewFinding;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], DraftReviewFinding.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'draft_id' }),
    __metadata("design:type", String)
], DraftReviewFinding.prototype, "draftId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => draft_entity_1.Draft, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'draft_id' }),
    __metadata("design:type", draft_entity_1.Draft)
], DraftReviewFinding.prototype, "draft", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], DraftReviewFinding.prototype, "page", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], DraftReviewFinding.prototype, "line", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'exact_text', type: 'text' }),
    __metadata("design:type", String)
], DraftReviewFinding.prototype, "exactText", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DraftReviewFinding.prototype, "severity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], DraftReviewFinding.prototype, "issue", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'legal_reasoning', type: 'text' }),
    __metadata("design:type", String)
], DraftReviewFinding.prototype, "legalReasoning", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], DraftReviewFinding.prototype, "suggestion", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'confidence_score', type: 'float' }),
    __metadata("design:type", Number)
], DraftReviewFinding.prototype, "confidenceScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DraftReviewFinding.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'annotation_type', nullable: true }),
    __metadata("design:type", String)
], DraftReviewFinding.prototype, "annotationType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'evidence_text', type: 'text', nullable: true }),
    __metadata("design:type", String)
], DraftReviewFinding.prototype, "evidenceText", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'nearby_text', type: 'text', nullable: true }),
    __metadata("design:type", String)
], DraftReviewFinding.prototype, "nearbyText", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'paragraph_number', nullable: true }),
    __metadata("design:type", Number)
], DraftReviewFinding.prototype, "paragraphNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'batch_index', default: 0 }),
    __metadata("design:type", Number)
], DraftReviewFinding.prototype, "batchIndex", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], DraftReviewFinding.prototype, "createdAt", void 0);
exports.DraftReviewFinding = DraftReviewFinding = __decorate([
    (0, typeorm_1.Entity)('draft_analyzer_review_findings'),
    (0, typeorm_1.Index)(['draftId', 'page', 'line'])
], DraftReviewFinding);
//# sourceMappingURL=draft-review-finding.entity.js.map
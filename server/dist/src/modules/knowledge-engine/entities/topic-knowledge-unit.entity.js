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
exports.TopicKnowledgeUnitEntity = void 0;
const typeorm_1 = require("typeorm");
let TopicKnowledgeUnitEntity = class TopicKnowledgeUnitEntity {
};
exports.TopicKnowledgeUnitEntity = TopicKnowledgeUnitEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], TopicKnowledgeUnitEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], TopicKnowledgeUnitEntity.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TopicKnowledgeUnitEntity.prototype, "topic", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TopicKnowledgeUnitEntity.prototype, "subtopic", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', default: '' }),
    __metadata("design:type", String)
], TopicKnowledgeUnitEntity.prototype, "summary", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], TopicKnowledgeUnitEntity.prototype, "definitions", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'legal_provisions', default: '[]' }),
    __metadata("design:type", Array)
], TopicKnowledgeUnitEntity.prototype, "legalProvisions", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], TopicKnowledgeUnitEntity.prototype, "principles", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], TopicKnowledgeUnitEntity.prototype, "exceptions", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'landmark_cases', default: '[]' }),
    __metadata("design:type", Array)
], TopicKnowledgeUnitEntity.prototype, "landmarkCases", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'referenced_cases', default: '[]' }),
    __metadata("design:type", Array)
], TopicKnowledgeUnitEntity.prototype, "referencedCases", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], TopicKnowledgeUnitEntity.prototype, "illustrations", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], TopicKnowledgeUnitEntity.prototype, "examples", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], TopicKnowledgeUnitEntity.prototype, "comparisons", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], TopicKnowledgeUnitEntity.prototype, "keywords", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], TopicKnowledgeUnitEntity.prototype, "references", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', name: 'coverage_score', default: 0 }),
    __metadata("design:type", Number)
], TopicKnowledgeUnitEntity.prototype, "coverageScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', name: 'confidence_score', default: 0 }),
    __metadata("design:type", Number)
], TopicKnowledgeUnitEntity.prototype, "confidenceScore", void 0);
__decorate([
    (0, typeorm_1.VersionColumn)(),
    __metadata("design:type", Number)
], TopicKnowledgeUnitEntity.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'last_updated' }),
    __metadata("design:type", Date)
], TopicKnowledgeUnitEntity.prototype, "lastUpdated", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], TopicKnowledgeUnitEntity.prototype, "createdAt", void 0);
exports.TopicKnowledgeUnitEntity = TopicKnowledgeUnitEntity = __decorate([
    (0, typeorm_1.Entity)('topic_knowledge_units'),
    (0, typeorm_1.Index)(['userId', 'topic', 'subtopic'], { unique: true }),
    (0, typeorm_1.Index)(['userId', 'coverageScore', 'confidenceScore'])
], TopicKnowledgeUnitEntity);
//# sourceMappingURL=topic-knowledge-unit.entity.js.map
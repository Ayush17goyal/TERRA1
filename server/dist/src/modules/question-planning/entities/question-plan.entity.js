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
exports.QuestionPlanEntity = void 0;
const typeorm_1 = require("typeorm");
let QuestionPlanEntity = class QuestionPlanEntity {
};
exports.QuestionPlanEntity = QuestionPlanEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], QuestionPlanEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], QuestionPlanEntity.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'ready' }),
    __metadata("design:type", String)
], QuestionPlanEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'coverage_matrix', default: '[]' }),
    __metadata("design:type", Array)
], QuestionPlanEntity.prototype, "coverageMatrix", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'mark_distribution', default: '[]' }),
    __metadata("design:type", Array)
], QuestionPlanEntity.prototype, "markDistribution", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'type_distribution', default: '[]' }),
    __metadata("design:type", Array)
], QuestionPlanEntity.prototype, "typeDistribution", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'question_requirements', default: '[]' }),
    __metadata("design:type", Array)
], QuestionPlanEntity.prototype, "questionRequirements", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '{}' }),
    __metadata("design:type", Object)
], QuestionPlanEntity.prototype, "summary", void 0);
__decorate([
    (0, typeorm_1.VersionColumn)(),
    __metadata("design:type", Number)
], QuestionPlanEntity.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], QuestionPlanEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], QuestionPlanEntity.prototype, "updatedAt", void 0);
exports.QuestionPlanEntity = QuestionPlanEntity = __decorate([
    (0, typeorm_1.Entity)('question_plans'),
    (0, typeorm_1.Index)(['userId'], { unique: true })
], QuestionPlanEntity);
//# sourceMappingURL=question-plan.entity.js.map
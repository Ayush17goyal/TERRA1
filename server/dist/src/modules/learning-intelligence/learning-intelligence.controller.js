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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LearningIntelligenceController = void 0;
const common_1 = require("@nestjs/common");
const clerk_auth_guard_1 = require("../../guards/clerk-auth.guard");
const learning_intelligence_service_1 = require("./learning-intelligence.service");
let LearningIntelligenceController = class LearningIntelligenceController {
    constructor(learningIntelligence) {
        this.learningIntelligence = learningIntelligence;
    }
    async recommendations(req) {
        return this.learningIntelligence.getReport(req.user.id);
    }
    async revisionPlan(req) {
        return this.learningIntelligence.getRevisionPlan(req.user.id);
    }
    async practiceQuestions(req) {
        return this.learningIntelligence.getPracticeQuestions(req.user.id);
    }
    async mockTests(req) {
        return this.learningIntelligence.getMockTestRecommendations(req.user.id);
    }
};
exports.LearningIntelligenceController = LearningIntelligenceController;
__decorate([
    (0, common_1.Get)('recommendations'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], LearningIntelligenceController.prototype, "recommendations", null);
__decorate([
    (0, common_1.Get)('revision-plan'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], LearningIntelligenceController.prototype, "revisionPlan", null);
__decorate([
    (0, common_1.Get)('practice-questions'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], LearningIntelligenceController.prototype, "practiceQuestions", null);
__decorate([
    (0, common_1.Get)('mock-tests'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], LearningIntelligenceController.prototype, "mockTests", null);
exports.LearningIntelligenceController = LearningIntelligenceController = __decorate([
    (0, common_1.Controller)('exam-engine/learning-intelligence'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __metadata("design:paramtypes", [learning_intelligence_service_1.LearningIntelligenceService])
], LearningIntelligenceController);
//# sourceMappingURL=learning-intelligence.controller.js.map
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
exports.JudgmentController = void 0;
const common_1 = require("@nestjs/common");
const judgment_service_1 = require("./judgment.service");
const clerk_auth_guard_1 = require("../../guards/clerk-auth.guard");
let JudgmentController = class JudgmentController {
    constructor(judgmentService) {
        this.judgmentService = judgmentService;
    }
    async analyzeJudgment(documentId, req) {
        return this.judgmentService.analyzeJudgment(documentId, req.user.id);
    }
    async getAnalysis(documentId, req) {
        return this.judgmentService.getAnalysis(documentId, req.user.id);
    }
    async explainMode(documentId, body, req) {
        return this.judgmentService.explainLike(documentId, body.mode, req.user.id);
    }
    async evaluateVerdict(documentId, body, req) {
        return this.judgmentService.evaluateVerdict(documentId, body.userVerdict, req.user.id);
    }
    async generateRevisionNotes(documentId, req) {
        return this.judgmentService.generateRevisionNotes(documentId, req.user.id);
    }
    async generateMootCourtKit(documentId, req) {
        return this.judgmentService.generateMootCourtKit(documentId, req.user.id);
    }
    async generateAlternativeReasoning(documentId, req) {
        return this.judgmentService.generateAlternativeReasoning(documentId, req.user.id);
    }
    async getJudgmentMastery(documentId, body, req) {
        return this.judgmentService.getJudgmentMastery(documentId, body.action, req.user.id);
    }
};
exports.JudgmentController = JudgmentController;
__decorate([
    (0, common_1.Post)(':documentId/analyze'),
    __param(0, (0, common_1.Param)('documentId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], JudgmentController.prototype, "analyzeJudgment", null);
__decorate([
    (0, common_1.Get)(':documentId/analysis'),
    __param(0, (0, common_1.Param)('documentId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], JudgmentController.prototype, "getAnalysis", null);
__decorate([
    (0, common_1.Post)(':documentId/explain'),
    __param(0, (0, common_1.Param)('documentId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], JudgmentController.prototype, "explainMode", null);
__decorate([
    (0, common_1.Post)(':documentId/evaluate-verdict'),
    __param(0, (0, common_1.Param)('documentId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], JudgmentController.prototype, "evaluateVerdict", null);
__decorate([
    (0, common_1.Post)(':documentId/revision-notes'),
    __param(0, (0, common_1.Param)('documentId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], JudgmentController.prototype, "generateRevisionNotes", null);
__decorate([
    (0, common_1.Post)(':documentId/moot-court-kit'),
    __param(0, (0, common_1.Param)('documentId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], JudgmentController.prototype, "generateMootCourtKit", null);
__decorate([
    (0, common_1.Post)(':documentId/alternative-reasoning'),
    __param(0, (0, common_1.Param)('documentId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], JudgmentController.prototype, "generateAlternativeReasoning", null);
__decorate([
    (0, common_1.Post)(':documentId/mastery'),
    __param(0, (0, common_1.Param)('documentId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], JudgmentController.prototype, "getJudgmentMastery", null);
exports.JudgmentController = JudgmentController = __decorate([
    (0, common_1.Controller)('judgments'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __metadata("design:paramtypes", [judgment_service_1.JudgmentService])
], JudgmentController);
//# sourceMappingURL=judgment.controller.js.map
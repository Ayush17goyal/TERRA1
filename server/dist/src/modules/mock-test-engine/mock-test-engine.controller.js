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
exports.MockTestEngineController = void 0;
const common_1 = require("@nestjs/common");
const clerk_auth_guard_1 = require("../../guards/clerk-auth.guard");
const mock_test_engine_service_1 = require("./mock-test-engine.service");
let MockTestEngineController = class MockTestEngineController {
    constructor(mockTests) {
        this.mockTests = mockTests;
    }
    async generate(body, req) {
        return this.mockTests.generatePaper(req.user.id, body || { prompt: '' });
    }
    async list(req) {
        return this.mockTests.listPapers(req.user.id);
    }
    async get(id, req) {
        const paper = await this.mockTests.getPaper(req.user.id, id);
        const questions = await this.mockTests.getPaperQuestions(req.user.id, id);
        return { ...paper, questions, pdfBase64: undefined };
    }
    async pdf(id, req, res) {
        const pdf = await this.mockTests.getPaperPdf(req.user.id, id);
        res.setHeader('Content-Disposition', `inline; filename="mock-test-${id}.pdf"`);
        res.send(pdf);
    }
    async getModelAnswer(questionId, req) {
        return this.mockTests.getModelAnswer(req.user.id, questionId);
    }
    async generateModelAnswer(questionId, body, req) {
        return this.mockTests.generateModelAnswer(req.user.id, questionId, body.question || '', body.topic || '', Number(body.markValue) || 15, body.force === true);
    }
};
exports.MockTestEngineController = MockTestEngineController;
__decorate([
    (0, common_1.Post)('generate'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MockTestEngineController.prototype, "generate", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MockTestEngineController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MockTestEngineController.prototype, "get", null);
__decorate([
    (0, common_1.Get)(':id/pdf'),
    (0, common_1.Header)('Content-Type', 'application/pdf'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], MockTestEngineController.prototype, "pdf", null);
__decorate([
    (0, common_1.Get)('questions/:questionId/model-answer'),
    __param(0, (0, common_1.Param)('questionId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MockTestEngineController.prototype, "getModelAnswer", null);
__decorate([
    (0, common_1.Post)('questions/:questionId/model-answer'),
    __param(0, (0, common_1.Param)('questionId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], MockTestEngineController.prototype, "generateModelAnswer", null);
exports.MockTestEngineController = MockTestEngineController = __decorate([
    (0, common_1.Controller)('exam-engine/mock-tests'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __metadata("design:paramtypes", [mock_test_engine_service_1.MockTestEngineService])
], MockTestEngineController);
//# sourceMappingURL=mock-test-engine.controller.js.map
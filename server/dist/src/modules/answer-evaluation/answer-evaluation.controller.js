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
exports.AnswerEvaluationController = void 0;
const common_1 = require("@nestjs/common");
const clerk_auth_guard_1 = require("../../guards/clerk-auth.guard");
const answer_evaluation_service_1 = require("./answer-evaluation.service");
let AnswerEvaluationController = class AnswerEvaluationController {
    constructor(answerEvaluation) {
        this.answerEvaluation = answerEvaluation;
    }
    async evaluate(body, req) {
        return this.answerEvaluation.evaluate(req.user.id, body);
    }
    async history(req) {
        return this.answerEvaluation.listHistory(req.user.id);
    }
    async questionHistory(questionId, req) {
        return this.answerEvaluation.listQuestionHistory(req.user.id, questionId);
    }
    async getAttempt(id, req) {
        return this.answerEvaluation.getAttempt(req.user.id, id);
    }
};
exports.AnswerEvaluationController = AnswerEvaluationController;
__decorate([
    (0, common_1.Post)('evaluate'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AnswerEvaluationController.prototype, "evaluate", null);
__decorate([
    (0, common_1.Get)('history'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AnswerEvaluationController.prototype, "history", null);
__decorate([
    (0, common_1.Get)('questions/:questionId/history'),
    __param(0, (0, common_1.Param)('questionId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AnswerEvaluationController.prototype, "questionHistory", null);
__decorate([
    (0, common_1.Get)('history/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AnswerEvaluationController.prototype, "getAttempt", null);
exports.AnswerEvaluationController = AnswerEvaluationController = __decorate([
    (0, common_1.Controller)('exam-engine/answer-evaluation'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __metadata("design:paramtypes", [answer_evaluation_service_1.AnswerEvaluationService])
], AnswerEvaluationController);
//# sourceMappingURL=answer-evaluation.controller.js.map
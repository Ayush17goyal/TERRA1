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
exports.QuestionPlanningController = void 0;
const common_1 = require("@nestjs/common");
const clerk_auth_guard_1 = require("../../guards/clerk-auth.guard");
const question_planning_service_1 = require("./question-planning.service");
let QuestionPlanningController = class QuestionPlanningController {
    constructor(planning) {
        this.planning = planning;
    }
    async build(req) {
        return this.planning.buildPlan(req.user.id);
    }
    async plan(req) {
        return this.planning.getPlan(req.user.id);
    }
    async slots(req) {
        return this.planning.getSlots(req.user.id);
    }
    async coverageMatrix(req) {
        return this.planning.getCoverageMatrix(req.user.id);
    }
};
exports.QuestionPlanningController = QuestionPlanningController;
__decorate([
    (0, common_1.Post)('build'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], QuestionPlanningController.prototype, "build", null);
__decorate([
    (0, common_1.Get)('plan'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], QuestionPlanningController.prototype, "plan", null);
__decorate([
    (0, common_1.Get)('slots'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], QuestionPlanningController.prototype, "slots", null);
__decorate([
    (0, common_1.Get)('coverage-matrix'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], QuestionPlanningController.prototype, "coverageMatrix", null);
exports.QuestionPlanningController = QuestionPlanningController = __decorate([
    (0, common_1.Controller)('exam-engine/question-planning'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __metadata("design:paramtypes", [question_planning_service_1.QuestionPlanningService])
], QuestionPlanningController);
//# sourceMappingURL=question-planning.controller.js.map
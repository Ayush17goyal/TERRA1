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
exports.CaseReasoningSimulatorController = void 0;
const common_1 = require("@nestjs/common");
const clerk_auth_guard_1 = require("../../guards/clerk-auth.guard");
const case_reasoning_simulator_service_1 = require("./case-reasoning-simulator.service");
let CaseReasoningSimulatorController = class CaseReasoningSimulatorController {
    constructor(simulator) {
        this.simulator = simulator;
    }
    analyze(req, body) {
        return this.simulator.analyze(req.user.id, body);
    }
    history(req) {
        return this.simulator.listHistory(req.user.id);
    }
    getAttempt(req, id) {
        return this.simulator.getAttempt(req.user.id, id);
    }
    saveAttempt(req, id) {
        return this.simulator.saveAttempt(req.user.id, id);
    }
};
exports.CaseReasoningSimulatorController = CaseReasoningSimulatorController;
__decorate([
    (0, common_1.Post)('analyze'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CaseReasoningSimulatorController.prototype, "analyze", null);
__decorate([
    (0, common_1.Get)('history'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CaseReasoningSimulatorController.prototype, "history", null);
__decorate([
    (0, common_1.Get)('history/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CaseReasoningSimulatorController.prototype, "getAttempt", null);
__decorate([
    (0, common_1.Patch)('history/:id/save'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CaseReasoningSimulatorController.prototype, "saveAttempt", null);
exports.CaseReasoningSimulatorController = CaseReasoningSimulatorController = __decorate([
    (0, common_1.Controller)('legal-intelligence/case-reasoning-simulator'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __metadata("design:paramtypes", [case_reasoning_simulator_service_1.CaseReasoningSimulatorService])
], CaseReasoningSimulatorController);
//# sourceMappingURL=case-reasoning-simulator.controller.js.map
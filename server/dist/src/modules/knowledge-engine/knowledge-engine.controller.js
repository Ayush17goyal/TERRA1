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
exports.KnowledgeEngineController = void 0;
const common_1 = require("@nestjs/common");
const clerk_auth_guard_1 = require("../../guards/clerk-auth.guard");
const knowledge_engine_service_1 = require("./knowledge-engine.service");
let KnowledgeEngineController = class KnowledgeEngineController {
    constructor(knowledgeEngine) {
        this.knowledgeEngine = knowledgeEngine;
    }
    async library(req) {
        return this.knowledgeEngine.getLibrary(req.user.id);
    }
    async topics(req) {
        return this.knowledgeEngine.listTopics(req.user.id);
    }
    async topic(id, req) {
        return this.knowledgeEngine.getTopic(req.user.id, id);
    }
    async graph(req) {
        return this.knowledgeEngine.getTopicGraph(req.user.id);
    }
};
exports.KnowledgeEngineController = KnowledgeEngineController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], KnowledgeEngineController.prototype, "library", null);
__decorate([
    (0, common_1.Get)('topics'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], KnowledgeEngineController.prototype, "topics", null);
__decorate([
    (0, common_1.Get)('topics/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], KnowledgeEngineController.prototype, "topic", null);
__decorate([
    (0, common_1.Get)('graph'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], KnowledgeEngineController.prototype, "graph", null);
exports.KnowledgeEngineController = KnowledgeEngineController = __decorate([
    (0, common_1.Controller)('document-engine/library'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __metadata("design:paramtypes", [knowledge_engine_service_1.KnowledgeEngineService])
], KnowledgeEngineController);
//# sourceMappingURL=knowledge-engine.controller.js.map
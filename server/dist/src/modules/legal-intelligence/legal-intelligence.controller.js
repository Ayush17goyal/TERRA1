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
exports.LegalIntelligenceController = void 0;
const common_1 = require("@nestjs/common");
const admin_role_guard_1 = require("../../guards/admin-role.guard");
const clerk_auth_guard_1 = require("../../guards/clerk-auth.guard");
const legal_intelligence_service_1 = require("./legal-intelligence.service");
let LegalIntelligenceController = class LegalIntelligenceController {
    constructor(service) {
        this.service = service;
    }
    verifyAuthority(req, body) {
        return this.service.verifyAuthority(req.user.id, body);
    }
    createResearchGuide(req, proposition) {
        return this.service.createResearchGuide(req.user.id, proposition);
    }
    checkDraft(req, body) {
        return this.service.checkDraft(req.user.id, body);
    }
    explainBareAct(req, body) {
        return this.service.explainBareAct(req.user.id, body);
    }
    simplifyBareAct(req, body) {
        return this.service.simplifyBareAct(req.user.id, body);
    }
    professorChat(req, body) {
        return this.service.professorChat(req.user.id, body);
    }
    analyzeBareActIntelligence(req, body) {
        if (!body.provisionText?.trim())
            throw new common_1.BadRequestException('provisionText is required');
        return this.service.analyzeBareActIntelligence(req.user.id, body);
    }
    professorTeach(req, body) {
        if (!body.provisionText?.trim())
            throw new common_1.BadRequestException('provisionText is required');
        return this.service.professorTeach(req.user.id, body);
    }
    bareActAiBar(req, body) {
        if (!body.provisionText?.trim())
            throw new common_1.BadRequestException('provisionText is required');
        return this.service.bareActAiBar(req.user.id, body);
    }
    howToWriteBareAct(req, body) {
        if (!body.provisionText?.trim())
            throw new common_1.BadRequestException('provisionText is required');
        return this.service.howToWriteBareAct(req.user.id, body);
    }
    listCourses() {
        return this.service.listCourses();
    }
    upsertCourse(body) {
        return this.service.upsertCourse(body);
    }
    deleteCourse(id) {
        return this.service.deleteCourse(id);
    }
    analyzeCaseReasoning(req, body) {
        return this.service.analyzeCaseReasoning(req.user.id, body);
    }
    researchMentorIntro(req, topic) {
        if (!topic?.trim())
            throw new common_1.BadRequestException('Topic is required');
        return this.service.researchMentorIntro(req.user.id, topic.trim());
    }
    researchMentorStep(req, body) {
        const topic = String(body.topic || '').trim();
        const stepNumber = Number(body.stepNumber || 1);
        if (!topic)
            throw new common_1.BadRequestException('Topic is required');
        return this.service.researchMentorStep(req.user.id, topic, stepNumber);
    }
    researchMentorGenerate(req, topic) {
        if (!topic?.trim())
            throw new common_1.BadRequestException('Topic is required');
        return this.service.researchMentorGenerate(req.user.id, topic.trim());
    }
    async researchMentorSessionStart(req, topic) {
        if (!topic?.trim())
            throw new common_1.BadRequestException('Topic is required');
        return this.service.researchMentorSessionStart(req.user.id, topic.trim());
    }
    async researchMentorSessionGet(req, id) {
        const session = await this.service.researchMentorSessionGet(req.user.id, id);
        if (!session)
            throw new common_1.NotFoundException('Session not found');
        return session;
    }
    async conductResearchAssistant(req, question) {
        if (!question?.trim())
            throw new common_1.BadRequestException('Question is required');
        return this.service.conductResearchAssistant(req.user.id, question.trim());
    }
    async getConversations(req) {
        return this.service.getConversations(req.user.id);
    }
    async saveConversation(req, body) {
        return this.service.saveConversation(req.user.id, body);
    }
    async saveMessage(req, body) {
        return this.service.saveMessage(req.user.id, body);
    }
    async deleteConversation(req, id) {
        return this.service.deleteConversation(req.user.id, id);
    }
    async getMessages(req, id) {
        return this.service.getMessages(req.user.id, id);
    }
    async renameConversation(req, id, title) {
        return this.service.renameConversation(req.user.id, id, title);
    }
};
exports.LegalIntelligenceController = LegalIntelligenceController;
__decorate([
    (0, common_1.Post)('authority-verification'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], LegalIntelligenceController.prototype, "verifyAuthority", null);
__decorate([
    (0, common_1.Post)('research-guide'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)('proposition')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LegalIntelligenceController.prototype, "createResearchGuide", null);
__decorate([
    (0, common_1.Post)('drafting/check'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], LegalIntelligenceController.prototype, "checkDraft", null);
__decorate([
    (0, common_1.Post)('bare-act/explain'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], LegalIntelligenceController.prototype, "explainBareAct", null);
__decorate([
    (0, common_1.Post)('bare-act/simplify'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], LegalIntelligenceController.prototype, "simplifyBareAct", null);
__decorate([
    (0, common_1.Post)('bare-act/professor-chat'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], LegalIntelligenceController.prototype, "professorChat", null);
__decorate([
    (0, common_1.Post)('bare-act/intelligence-studio'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], LegalIntelligenceController.prototype, "analyzeBareActIntelligence", null);
__decorate([
    (0, common_1.Post)('bare-act/professor-teach'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], LegalIntelligenceController.prototype, "professorTeach", null);
__decorate([
    (0, common_1.Post)('bare-act/ai-bar'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], LegalIntelligenceController.prototype, "bareActAiBar", null);
__decorate([
    (0, common_1.Post)('bare-act/how-to-write'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], LegalIntelligenceController.prototype, "howToWriteBareAct", null);
__decorate([
    (0, common_1.Get)('drafting/courses'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LegalIntelligenceController.prototype, "listCourses", null);
__decorate([
    (0, common_1.Post)('drafting/admin/courses'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard, admin_role_guard_1.AdminRoleGuard),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LegalIntelligenceController.prototype, "upsertCourse", null);
__decorate([
    (0, common_1.Delete)('drafting/admin/courses/:id'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard, admin_role_guard_1.AdminRoleGuard),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LegalIntelligenceController.prototype, "deleteCourse", null);
__decorate([
    (0, common_1.Post)('case-simulator/analyze'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], LegalIntelligenceController.prototype, "analyzeCaseReasoning", null);
__decorate([
    (0, common_1.Post)('research-mentor/intro'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)('topic')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LegalIntelligenceController.prototype, "researchMentorIntro", null);
__decorate([
    (0, common_1.Post)('research-mentor/step'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], LegalIntelligenceController.prototype, "researchMentorStep", null);
__decorate([
    (0, common_1.Post)('research-mentor/generate'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)('topic')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LegalIntelligenceController.prototype, "researchMentorGenerate", null);
__decorate([
    (0, common_1.Post)('research-mentor/session/start'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)('topic')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], LegalIntelligenceController.prototype, "researchMentorSessionStart", null);
__decorate([
    (0, common_1.Get)('research-mentor/session/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], LegalIntelligenceController.prototype, "researchMentorSessionGet", null);
__decorate([
    (0, common_1.Post)('research-assistant/conduct'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)('question')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], LegalIntelligenceController.prototype, "conductResearchAssistant", null);
__decorate([
    (0, common_1.Get)('bare-act/conversations'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], LegalIntelligenceController.prototype, "getConversations", null);
__decorate([
    (0, common_1.Post)('bare-act/conversations'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], LegalIntelligenceController.prototype, "saveConversation", null);
__decorate([
    (0, common_1.Post)('bare-act/messages'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], LegalIntelligenceController.prototype, "saveMessage", null);
__decorate([
    (0, common_1.Delete)('bare-act/conversations/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], LegalIntelligenceController.prototype, "deleteConversation", null);
__decorate([
    (0, common_1.Get)('bare-act/conversations/:id/messages'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], LegalIntelligenceController.prototype, "getMessages", null);
__decorate([
    (0, common_1.Post)('bare-act/conversations/:id/rename'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('title')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], LegalIntelligenceController.prototype, "renameConversation", null);
exports.LegalIntelligenceController = LegalIntelligenceController = __decorate([
    (0, common_1.Controller)('legal-intelligence'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __metadata("design:paramtypes", [legal_intelligence_service_1.LegalIntelligenceService])
], LegalIntelligenceController);
//# sourceMappingURL=legal-intelligence.controller.js.map
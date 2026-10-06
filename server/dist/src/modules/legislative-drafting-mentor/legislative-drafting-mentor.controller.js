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
var LegislativeDraftingMentorController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegislativeDraftingMentorController = void 0;
const common_1 = require("@nestjs/common");
const clerk_auth_guard_1 = require("../../guards/clerk-auth.guard");
const drafting_workflow_engine_service_1 = require("./drafting-workflow-engine.service");
const academy_professor_service_1 = require("./academy-professor.service");
const academy_curriculum_1 = require("./academy-curriculum");
let LegislativeDraftingMentorController = LegislativeDraftingMentorController_1 = class LegislativeDraftingMentorController {
    constructor(workflowEngine, professor) {
        this.workflowEngine = workflowEngine;
        this.professor = professor;
        this.logger = new common_1.Logger(LegislativeDraftingMentorController_1.name);
    }
    getAcademyCurriculum() { return academy_curriculum_1.ACADEMY_CURRICULUM; }
    getAcademyLesson(req, index) { return this.professor.lesson(req.user.id, Number(index)); }
    async reviewAcademyDraft(req, index, answer) {
        const started = Date.now();
        this.logger.log('Review controller request user=' + req.user.id + '; lesson=' + index + '; answerLength=' + String(answer || '').length);
        try {
            const result = await this.professor.review(req.user.id, Number(index), answer);
            this.logger.log('Review controller response user=' + req.user.id + '; lesson=' + index + '; status=200; verdict=' + result.status + '; score=' + result.overallScore + '; durationMs=' + (Date.now() - started));
            return result;
        }
        catch (error) {
            this.logger.error('Review controller error user=' + req.user.id + '; lesson=' + index + '; status=' + (error?.status || 500) + '; durationMs=' + (Date.now() - started) + '; error=' + (error?.message || String(error)));
            throw error;
        }
    }
    async gradeAcademyMastery(req, index, answer) {
        return this.professor.mastery(req.user.id, Number(index), answer);
    }
    async generatePractice(req, index, prompt, difficulty) {
        return this.professor.generatePractice(req.user.id, Number(index), prompt, difficulty);
    }
    getAcademyState(req) {
        return this.workflowEngine.getAcademyState(req.user.id);
    }
    syncAcademyState(req, body) {
        return this.workflowEngine.syncAcademyState(req.user.id, body);
    }
    getLessonCatalog() {
        return this.workflowEngine.getLessonCatalog();
    }
    createSession(req, topic) {
        return this.workflowEngine.createSession(req.user.id, topic);
    }
    listSessions(req) {
        return this.workflowEngine.listSessions(req.user.id);
    }
    resumeSession(req, id) {
        return this.workflowEngine.resumeSession(req.user.id, id);
    }
    advance(req, id) {
        return this.workflowEngine.advance(req.user.id, id);
    }
    goBack(req, id) {
        return this.workflowEngine.goBack(req.user.id, id);
    }
    goToLesson(req, id, lessonIndex) {
        return this.workflowEngine.goToLesson(req.user.id, id, Number(lessonIndex));
    }
};
exports.LegislativeDraftingMentorController = LegislativeDraftingMentorController;
__decorate([
    (0, common_1.Get)('academy/curriculum'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LegislativeDraftingMentorController.prototype, "getAcademyCurriculum", null);
__decorate([
    (0, common_1.Get)('academy/lessons/:index'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('index')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LegislativeDraftingMentorController.prototype, "getAcademyLesson", null);
__decorate([
    (0, common_1.Post)('academy/lessons/:index/review'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('index')),
    __param(2, (0, common_1.Body)('answer')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], LegislativeDraftingMentorController.prototype, "reviewAcademyDraft", null);
__decorate([
    (0, common_1.Post)('academy/lessons/:index/mastery'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('index')),
    __param(2, (0, common_1.Body)('answer')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], LegislativeDraftingMentorController.prototype, "gradeAcademyMastery", null);
__decorate([
    (0, common_1.Post)('academy/lessons/:index/practice'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('index')),
    __param(2, (0, common_1.Body)('prompt')),
    __param(3, (0, common_1.Body)('difficulty')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], LegislativeDraftingMentorController.prototype, "generatePractice", null);
__decorate([
    (0, common_1.Get)('academy/state'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LegislativeDraftingMentorController.prototype, "getAcademyState", null);
__decorate([
    (0, common_1.Put)('academy/state'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], LegislativeDraftingMentorController.prototype, "syncAcademyState", null);
__decorate([
    (0, common_1.Get)('lessons'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LegislativeDraftingMentorController.prototype, "getLessonCatalog", null);
__decorate([
    (0, common_1.Post)('sessions'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)('topic')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LegislativeDraftingMentorController.prototype, "createSession", null);
__decorate([
    (0, common_1.Get)('sessions'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LegislativeDraftingMentorController.prototype, "listSessions", null);
__decorate([
    (0, common_1.Get)('sessions/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LegislativeDraftingMentorController.prototype, "resumeSession", null);
__decorate([
    (0, common_1.Post)('sessions/:id/advance'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LegislativeDraftingMentorController.prototype, "advance", null);
__decorate([
    (0, common_1.Post)('sessions/:id/back'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LegislativeDraftingMentorController.prototype, "goBack", null);
__decorate([
    (0, common_1.Post)('sessions/:id/goto'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('lessonIndex')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Number]),
    __metadata("design:returntype", void 0)
], LegislativeDraftingMentorController.prototype, "goToLesson", null);
exports.LegislativeDraftingMentorController = LegislativeDraftingMentorController = LegislativeDraftingMentorController_1 = __decorate([
    (0, common_1.Controller)('drafting-mentor'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __metadata("design:paramtypes", [drafting_workflow_engine_service_1.DraftingWorkflowEngineService,
        academy_professor_service_1.AcademyProfessorService])
], LegislativeDraftingMentorController);
//# sourceMappingURL=legislative-drafting-mentor.controller.js.map
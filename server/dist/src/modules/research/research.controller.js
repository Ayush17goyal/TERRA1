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
exports.ResearchController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const clerk_auth_guard_1 = require("../../guards/clerk-auth.guard");
const command_center_access_guard_1 = require("../../guards/command-center-access.guard");
const research_service_1 = require("./research.service");
const settings_service_1 = require("../settings/settings.service");
let ResearchController = class ResearchController {
    constructor(research, settings) {
        this.research = research;
        this.settings = settings;
    }
    async userId(req) {
        const user = await this.research.resolveUser(req.user);
        return user.id;
    }
    async createQuery(req, body) {
        const userId = await this.userId(req);
        const result = await this.research.createQuery(userId, body);
        await this.settings.log({ userId: req.user.id, module: 'Research Command Center', action: 'Started Research Session', metadata: { topic: body.topic, researchMode: body.researchMode } });
        return result;
    }
    async listQueries(req) {
        return this.research.listQueries(await this.userId(req));
    }
    async getQuery(req, id) {
        return this.research.getQuery(await this.userId(req), id);
    }
    async createReport(req, body) {
        const userId = await this.userId(req);
        const result = await this.research.createReport(userId, body);
        await this.settings.log({ userId: req.user.id, module: 'Research Command Center', action: 'Generated Research Report', metadata: { reportId: result.id, title: result.title } });
        return result;
    }
    async getReport(req, id) {
        return this.research.getReport(await this.userId(req), id);
    }
    async updateReport(req, id, body) {
        return this.research.updateReport(await this.userId(req), id, body);
    }
    async deleteReport(req, id) {
        return this.research.deleteReport(await this.userId(req), id);
    }
    async createNote(req, body) {
        const userId = await this.userId(req);
        const result = await this.research.createNote(userId, body);
        await this.settings.log({ userId: req.user.id, module: 'Research Command Center', action: 'Created Research Note', metadata: { reportId: body.reportId, title: body.title } });
        return result;
    }
    async getNote(req, id) {
        return this.research.getNote(await this.userId(req), id);
    }
    async updateNote(req, id, body) {
        return this.research.updateNote(await this.userId(req), id, body);
    }
    async deleteNote(req, id) {
        return this.research.deleteNote(await this.userId(req), id);
    }
    async createSource(req, body) {
        const userId = await this.userId(req);
        const result = await this.research.createSource(userId, body);
        await this.settings.log({ userId: req.user.id, module: 'Research Command Center', action: body.sourceType === 'case' ? 'Retrieved Case' : 'Added Source', metadata: { reportId: body.reportId, sourceType: body.sourceType, title: body.title } });
        return result;
    }
    async getSource(req, id) {
        return this.research.getSource(await this.userId(req), id);
    }
    async deleteSource(req, id) {
        return this.research.deleteSource(await this.userId(req), id);
    }
    async saveReport(req, body) {
        return this.research.saveReport(await this.userId(req), body.reportId);
    }
    async listSavedReports(req) {
        return this.research.listSavedReports(await this.userId(req));
    }
    async deleteSavedReport(req, id) {
        return this.research.deleteSavedReport(await this.userId(req), id);
    }
    async createAsset(req, body) {
        return this.research.createAsset(await this.userId(req), body);
    }
    async uploadFile(req, file, body) {
        const userId = await this.userId(req);
        let validQueryId = body.queryId?.trim() || undefined;
        if (validQueryId) {
            try {
                await this.research.getQuery(userId, validQueryId);
            }
            catch {
                validQueryId = undefined;
            }
        }
        const result = await this.research.uploadDocument(userId, file, validQueryId, body.docCategory);
        await this.settings.log({
            userId: req.user.id,
            module: 'Research Command Center',
            action: 'Uploaded Research Document',
            metadata: {
                queryId: validQueryId || null,
                docCategory: body.docCategory,
                name: file?.originalname,
            },
        });
        return result;
    }
    async getDocuments(req, queryId) {
        const userId = await this.userId(req);
        return this.research.getDocuments(userId, queryId);
    }
    async generateResearch(req, body) {
        const userId = await this.userId(req);
        const result = await this.research.generateReport(userId, body);
        await this.settings.log({
            userId: req.user.id,
            module: 'Research Command Center',
            action: 'Generated Research Report',
            metadata: {
                reportId: result?.id,
                topic: body.topic,
                researchMode: body.researchMode,
                sources: body.sources?.length || 0,
            },
        });
        return result;
    }
    async generateJudgmentIntelligence(req, body) {
        const userId = await this.userId(req);
        const result = await this.research.generateJudgmentIntelligence(userId, body);
        await this.settings.log({
            userId: req.user.id,
            module: 'Judgment Intelligence Engine',
            action: 'Generated Judgment Intelligence Report',
            metadata: { reportId: result?.id, topic: body.topic, sources: body.sources?.length || 0 },
        });
        return result;
    }
    async generateLegalBrief(req, body) {
        const userId = await this.userId(req);
        const result = await this.research.generateLegalBrief(userId, body);
        await this.settings.log({
            userId: req.user.id,
            module: 'Legal Research Command Center',
            action: 'Generated Legal Brief',
            metadata: { reportId: result?.id, topic: body.topic, template: 'Model Case Brief' },
        });
        return result;
    }
    async generateBareActAnalysis(req, body) {
        const userId = await this.userId(req);
        const result = await this.research.generateBareActAnalysis(userId, body);
        await this.settings.log({
            userId: req.user.id,
            module: 'Legal Research Command Center',
            action: 'Generated Bare Act Analysis',
            metadata: { reportId: result?.id, topic: body.topic, template: 'Bare Act Statutory Analysis' },
        });
        return result;
    }
    async generateCommandCenterBareActAnalysis(req, body) {
        const userId = await this.userId(req);
        const result = await this.research.generateBareActAnalysis(userId, body);
        await this.settings.log({
            userId: req.user.id,
            module: 'Legal Research Command Center',
            action: 'Generated Bare Act Analysis',
            metadata: { reportId: result?.id, topic: body.topic, template: 'Bare Act Statutory Analysis' },
        });
        return result;
    }
    async listJudgmentReports(req, search) {
        return this.research.listJudgmentReports(await this.userId(req), search);
    }
    async judgmentAnalytics(req) {
        return this.research.getJudgmentAnalytics(await this.userId(req));
    }
    async getJudgmentReport(req, id) {
        return this.research.getJudgmentReport(await this.userId(req), id);
    }
    async deleteJudgmentReport(req, id) {
        return this.research.deleteJudgmentReport(await this.userId(req), id);
    }
    async challengeResearch(req, body) {
        const userId = await this.userId(req);
        const result = await this.research.challengeReport(userId, body.reportId);
        await this.settings.log({ userId: req.user.id, module: 'Research Command Center', action: 'Challenged Research Report', metadata: { reportId: body.reportId } });
        return result;
    }
};
exports.ResearchController = ResearchController;
__decorate([
    (0, common_1.Post)('query'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "createQuery", null);
__decorate([
    (0, common_1.Get)('query/all'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "listQueries", null);
__decorate([
    (0, common_1.Get)('query/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "getQuery", null);
__decorate([
    (0, common_1.Post)('report'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "createReport", null);
__decorate([
    (0, common_1.Get)('report/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "getReport", null);
__decorate([
    (0, common_1.Put)('report/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "updateReport", null);
__decorate([
    (0, common_1.Delete)('report/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "deleteReport", null);
__decorate([
    (0, common_1.Post)('note'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "createNote", null);
__decorate([
    (0, common_1.Get)('note/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "getNote", null);
__decorate([
    (0, common_1.Put)('note/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "updateNote", null);
__decorate([
    (0, common_1.Delete)('note/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "deleteNote", null);
__decorate([
    (0, common_1.Post)('source'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "createSource", null);
__decorate([
    (0, common_1.Get)('source/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "getSource", null);
__decorate([
    (0, common_1.Delete)('source/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "deleteSource", null);
__decorate([
    (0, common_1.Post)('save'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "saveReport", null);
__decorate([
    (0, common_1.Get)('save/all'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "listSavedReports", null);
__decorate([
    (0, common_1.Delete)('save/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "deleteSavedReport", null);
__decorate([
    (0, common_1.Post)('asset'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "createAsset", null);
__decorate([
    (0, common_1.Post)('upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "uploadFile", null);
__decorate([
    (0, common_1.Get)('documents/:queryId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('queryId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "getDocuments", null);
__decorate([
    (0, common_1.Post)('generate'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "generateResearch", null);
__decorate([
    (0, common_1.Post)('judgment-intelligence'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "generateJudgmentIntelligence", null);
__decorate([
    (0, common_1.Post)('legal-brief'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "generateLegalBrief", null);
__decorate([
    (0, common_1.Post)('bare-act'),
    (0, command_center_access_guard_1.AllowWithoutCommandCenterAccess)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "generateBareActAnalysis", null);
__decorate([
    (0, common_1.Post)('command-center/bare-act'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "generateCommandCenterBareActAnalysis", null);
__decorate([
    (0, common_1.Get)('judgment-intelligence'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "listJudgmentReports", null);
__decorate([
    (0, common_1.Get)('judgment-intelligence/analytics'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "judgmentAnalytics", null);
__decorate([
    (0, common_1.Get)('judgment-intelligence/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "getJudgmentReport", null);
__decorate([
    (0, common_1.Delete)('judgment-intelligence/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "deleteJudgmentReport", null);
__decorate([
    (0, common_1.Post)('challenge'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ResearchController.prototype, "challengeResearch", null);
exports.ResearchController = ResearchController = __decorate([
    (0, common_1.Controller)('research'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard, command_center_access_guard_1.CommandCenterAccessGuard),
    __metadata("design:paramtypes", [research_service_1.ResearchService,
        settings_service_1.SettingsService])
], ResearchController);
//# sourceMappingURL=research.controller.js.map
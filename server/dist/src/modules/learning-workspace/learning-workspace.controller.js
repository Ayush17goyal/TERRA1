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
exports.LearningWorkspaceController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const clerk_auth_guard_1 = require("../../guards/clerk-auth.guard");
const learning_workspace_service_1 = require("./learning-workspace.service");
const settings_service_1 = require("../settings/settings.service");
const MAX_LEARNING_UPLOAD_BYTES = Number(process.env.MAX_LEARNING_UPLOAD_BYTES || 25 * 1024 * 1024);
const MAX_LEARNING_BULK_FILES = Number(process.env.MAX_LEARNING_BULK_FILES || 50);
const MAX_LEARNING_BULK_BYTES = Number(process.env.MAX_LEARNING_BULK_BYTES || 150 * 1024 * 1024);
let LearningWorkspaceController = class LearningWorkspaceController {
    constructor(service, settings) {
        this.service = service;
        this.settings = settings;
    }
    list(req) {
        return this.service.listWorkspace(this.userId(req));
    }
    async createTextSource(req, body) {
        const userId = this.userId(req);
        const result = await this.service.createTextSource(userId, body);
        await this.settings.log({ userId, module: 'AI Learning & Assessment Studio', action: 'Added Learning Source', metadata: { kind: body.kind } });
        return result;
    }
    async uploadSource(req, file, kind) {
        const userId = this.userId(req);
        if (!file) {
            throw new common_1.BadRequestException('Multipart file payload missing.');
        }
        this.validateUploadedFile(file);
        const result = await this.service.uploadSource(userId, kind, file);
        await this.settings.log({ userId, module: 'AI Learning & Assessment Studio', action: 'Uploaded Learning Source', metadata: { kind, name: file?.originalname } });
        return result;
    }
    async uploadSources(req, files, kind) {
        const userId = this.userId(req);
        this.validateBulkUpload(files || []);
        const result = await this.service.uploadSources(userId, files || [], kind);
        await this.settings.log({
            userId,
            module: 'AI Learning & Assessment Studio',
            action: 'Bulk Uploaded Learning Sources',
            metadata: { count: result.length, kind },
        });
        return { accepted: result.length, sources: result };
    }
    async renameSource(req, id, newName) {
        const userId = this.userId(req);
        const result = await this.service.renameSource(userId, id, newName);
        await this.settings.log({ userId, module: 'AI Learning & Assessment Studio', action: 'Renamed Learning Source', metadata: { id, newName } });
        return result;
    }
    async deleteSource(req, id) {
        const userId = this.userId(req);
        const result = await this.service.deleteSource(userId, id);
        await this.settings.log({ userId, module: 'AI Learning & Assessment Studio', action: 'Deleted Learning Source', metadata: { id } });
        return result;
    }
    async reprocessSource(req, id) {
        const userId = this.userId(req);
        const result = await this.service.reprocessSource(userId, id);
        await this.settings.log({ userId, module: 'AI Learning & Assessment Studio', action: 'Reprocessed Learning Source', metadata: { id } });
        return result;
    }
    async generateMockTest(req, body) {
        const userId = this.userId(req);
        const result = await this.service.generateMockTest(userId, body);
        await this.settings.log({ userId, module: 'AI Learning & Assessment Studio', action: 'Generated Mock Test', metadata: { questionCount: result?.questions?.length || 0, mode: body.mode } });
        return result;
    }
    async generateDetailedAnswer(req, id, questionId, body) {
        const userId = this.userId(req);
        const result = await this.service.generateDetailedAnswer(userId, id, questionId, body.mode || 'Short Answer', !!body.regenerate || !!body.force);
        await this.settings.log({
            userId,
            module: 'AI Learning & Assessment Studio',
            action: 'Generated Mock Test Answer On Demand',
            metadata: { mockTestId: id, questionId, mode: result?.mode, cached: result?.cached },
        });
        return result;
    }
    async submitMockTest(req, id, body) {
        const userId = this.userId(req);
        const result = await this.service.submitMockTest(userId, id, body.answers || {}, body.timeTaken || 0);
        await this.settings.log({ userId, module: 'AI Learning & Assessment Studio', action: 'Completed Quiz', metadata: { mockTestId: id, score: result?.score } });
        return result;
    }
    async exportMockTest(req, id, format, res) {
        const userId = this.userId(req);
        const test = await this.service.getMockTest(userId, id);
        const result = await this.service.compileMockTest(test, format);
        res.set({
            'Content-Type': result.contentType,
            'Content-Disposition': `attachment; filename="MockTest-${id}.${format}"`,
            'Content-Length': result.buffer.length,
        });
        res.end(result.buffer);
    }
    async exportMockTestFromClient(req, body, format, res) {
        const result = await this.service.compileMockTest(body.test, format);
        res.set({
            'Content-Type': result.contentType,
            'Content-Disposition': `attachment; filename="MockTest.${format}"`,
            'Content-Length': result.buffer.length,
        });
        res.end(result.buffer);
    }
    async generateMindMap(req, body) {
        const userId = this.userId(req);
        const result = await this.service.generateMindMap(userId, body);
        await this.settings.log({ userId, module: 'AI Learning & Assessment Studio', action: 'Generated Mind Map', metadata: { title: result?.title } });
        return result;
    }
    async exportMindMap(req, id, format, res) {
        const userId = this.userId(req);
        const map = await this.service.getMindMap(userId, id);
        const result = await this.service.compileMindMap(map, format);
        res.set({
            'Content-Type': result.contentType,
            'Content-Disposition': `attachment; filename="MindMap-${id}.${format}"`,
            'Content-Length': result.buffer.length,
        });
        res.end(result.buffer);
    }
    async generateStudyKit(req, body) {
        const userId = this.userId(req);
        const result = await this.service.generateStudyKit(userId, body);
        await this.settings.log({
            userId,
            module: 'AI Learning & Assessment Studio',
            action: 'Generated Study Kit',
            metadata: { flashcards: result?.content?.flashcards?.length || 0 },
        });
        return result;
    }
    async exportStudyKit(req, id, format, res) {
        const userId = this.userId(req);
        const kit = await this.service.getStudyKit(userId, id);
        const result = await this.service.compileStudyKit(kit, format);
        res.set({
            'Content-Type': result.contentType,
            'Content-Disposition': `attachment; filename="StudyKit-${id}.${format}"`,
            'Content-Length': result.buffer.length,
        });
        res.end(result.buffer);
    }
    async reviewFlashcard(req, body) {
        const userId = this.userId(req);
        const result = await this.service.reviewFlashcard(userId, body);
        await this.settings.log({ userId, module: 'AI Learning & Assessment Studio', action: 'Reviewed Flashcard', metadata: { rating: body.rating, correct: body.correct } });
        return result;
    }
    async generateRevisionPlanner(req, durationDays) {
        const userId = this.userId(req);
        const result = await this.service.generateRevisionPlanner(userId, durationDays || 7);
        await this.settings.log({ userId, module: 'AI Learning & Assessment Studio', action: 'Generated Revision Plan', metadata: { durationDays } });
        return result;
    }
    weakAreas(req) {
        return this.service.getWeakAreaReport(this.userId(req));
    }
    analytics(req) {
        return this.service.getAnalytics(this.userId(req));
    }
    pauseIndexing() {
        return this.service.pauseIndexing();
    }
    resumeIndexing() {
        return this.service.resumeIndexing();
    }
    getIndexingStatus() {
        return this.service.getIndexingStatus();
    }
    validateUploadedFile(file) {
        if (!file?.buffer || Number(file.size || 0) <= 0) {
            throw new common_1.BadRequestException('Uploaded file is empty.');
        }
        if (Number(file.size || 0) > MAX_LEARNING_UPLOAD_BYTES) {
            throw new common_1.PayloadTooLargeException(`File is too large. Maximum allowed size is ${Math.floor(MAX_LEARNING_UPLOAD_BYTES / (1024 * 1024))} MB.`);
        }
    }
    validateBulkUpload(files) {
        if (!files.length) {
            throw new common_1.BadRequestException('No files were uploaded.');
        }
        if (files.length > MAX_LEARNING_BULK_FILES) {
            throw new common_1.PayloadTooLargeException(`Too many files. Maximum allowed files per upload is ${MAX_LEARNING_BULK_FILES}.`);
        }
        let totalSize = 0;
        for (const file of files) {
            this.validateUploadedFile(file);
            totalSize += Number(file.size || 0);
        }
        if (totalSize > MAX_LEARNING_BULK_BYTES) {
            throw new common_1.PayloadTooLargeException(`Bulk upload is too large. Maximum allowed total size is ${Math.floor(MAX_LEARNING_BULK_BYTES / (1024 * 1024))} MB.`);
        }
    }
    userId(req) {
        return req.user.id;
    }
};
exports.LearningWorkspaceController = LearningWorkspaceController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LearningWorkspaceController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('sources/text'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], LearningWorkspaceController.prototype, "createTextSource", null);
__decorate([
    (0, common_1.Post)('sources/upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: MAX_LEARNING_UPLOAD_BYTES } })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)('kind')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], LearningWorkspaceController.prototype, "uploadSource", null);
__decorate([
    (0, common_1.Post)('sources/bulk-upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', MAX_LEARNING_BULK_FILES, { limits: { fileSize: MAX_LEARNING_UPLOAD_BYTES, files: MAX_LEARNING_BULK_FILES } })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFiles)()),
    __param(2, (0, common_1.Body)('kind')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Array, String]),
    __metadata("design:returntype", Promise)
], LearningWorkspaceController.prototype, "uploadSources", null);
__decorate([
    (0, common_1.Post)('sources/:id/rename'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('newName')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], LearningWorkspaceController.prototype, "renameSource", null);
__decorate([
    (0, common_1.Post)('sources/:id/delete'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], LearningWorkspaceController.prototype, "deleteSource", null);
__decorate([
    (0, common_1.Post)('sources/:id/reprocess'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], LearningWorkspaceController.prototype, "reprocessSource", null);
__decorate([
    (0, common_1.Post)('mock-tests/generate'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], LearningWorkspaceController.prototype, "generateMockTest", null);
__decorate([
    (0, common_1.Post)('mock-tests/:id/questions/:questionId/answer'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('questionId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], LearningWorkspaceController.prototype, "generateDetailedAnswer", null);
__decorate([
    (0, common_1.Post)('mock-tests/:id/submit'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], LearningWorkspaceController.prototype, "submitMockTest", null);
__decorate([
    (0, common_1.Get)('mock-tests/:id/export/:format'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('format')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], LearningWorkspaceController.prototype, "exportMockTest", null);
__decorate([
    (0, common_1.Post)('mock-tests/export-compile/:format'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Param)('format')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, Object]),
    __metadata("design:returntype", Promise)
], LearningWorkspaceController.prototype, "exportMockTestFromClient", null);
__decorate([
    (0, common_1.Post)('mind-maps/generate'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], LearningWorkspaceController.prototype, "generateMindMap", null);
__decorate([
    (0, common_1.Get)('mind-maps/:id/export/:format'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('format')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], LearningWorkspaceController.prototype, "exportMindMap", null);
__decorate([
    (0, common_1.Post)('study-kits/generate'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], LearningWorkspaceController.prototype, "generateStudyKit", null);
__decorate([
    (0, common_1.Get)('study-kits/:id/export/:format'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('format')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], LearningWorkspaceController.prototype, "exportStudyKit", null);
__decorate([
    (0, common_1.Post)('flashcards/review'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], LearningWorkspaceController.prototype, "reviewFlashcard", null);
__decorate([
    (0, common_1.Post)('revision-plan/generate'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)('durationDays')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], LearningWorkspaceController.prototype, "generateRevisionPlanner", null);
__decorate([
    (0, common_1.Get)('weak-areas'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LearningWorkspaceController.prototype, "weakAreas", null);
__decorate([
    (0, common_1.Get)('analytics'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LearningWorkspaceController.prototype, "analytics", null);
__decorate([
    (0, common_1.Post)('indexing/pause'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LearningWorkspaceController.prototype, "pauseIndexing", null);
__decorate([
    (0, common_1.Post)('indexing/resume'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LearningWorkspaceController.prototype, "resumeIndexing", null);
__decorate([
    (0, common_1.Get)('indexing/status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LearningWorkspaceController.prototype, "getIndexingStatus", null);
exports.LearningWorkspaceController = LearningWorkspaceController = __decorate([
    (0, common_1.Controller)('learning-workspace'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __metadata("design:paramtypes", [learning_workspace_service_1.LearningWorkspaceService,
        settings_service_1.SettingsService])
], LearningWorkspaceController);
//# sourceMappingURL=learning-workspace.controller.js.map
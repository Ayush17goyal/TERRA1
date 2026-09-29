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
exports.DraftAnalyzerController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const draft_analyzer_service_1 = require("./draft-analyzer.service");
const extraction_service_1 = require("./services/extraction.service");
const ai_reviewer_service_1 = require("./services/ai-reviewer.service");
const progress_service_1 = require("./services/progress.service");
const clerk_auth_guard_1 = require("../../guards/clerk-auth.guard");
const MAX_FILE_BYTES = Number(process.env.DRAFT_ANALYZER_MAX_BYTES || 25 * 1024 * 1024);
let DraftAnalyzerController = class DraftAnalyzerController {
    constructor(service, extractionService, aiReviewer, progressService) {
        this.service = service;
        this.extractionService = extractionService;
        this.aiReviewer = aiReviewer;
        this.progressService = progressService;
    }
    async upload(file, req) {
        if (!file)
            throw new common_1.HttpException('No file provided.', common_1.HttpStatus.BAD_REQUEST);
        return this.service.upload(req.user.id, {
            originalname: file.originalname,
            buffer: file.buffer,
            size: file.size,
            mimetype: file.mimetype,
        });
    }
    async extract(id, req) {
        return this.extractionService.extract(id, req.user.id);
    }
    async listPages(id, req) {
        return this.extractionService.getPages(id, req.user.id);
    }
    async getPage(id, pageNum, req) {
        return this.extractionService.getPage(id, req.user.id, pageNum);
    }
    async review(id, req) {
        return this.aiReviewer.review(id, req.user.id);
    }
    async getReview(id, req) {
        return this.aiReviewer.getFindings(id, req.user.id);
    }
    async getAuditStatus(id, req) {
        return this.aiReviewer.getAuditStatus(id, req.user.id);
    }
    async fileUrl(id, req) {
        return this.service.getFileUrl(req.user.id, id);
    }
    async fileData(id, req, res) {
        const { buffer, mimeType } = await this.service.getFileData(req.user.id, id);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'private, max-age=3600');
        res.end(buffer);
    }
    async blocks(id, req) {
        return this.extractionService.getAllLineBlocks(id, req.user.id);
    }
    async analyze(id, req) {
        await this.service.getStatus(req.user.id, id);
        this.service.analyzeInBackground(id, req.user.id).catch(() => { });
        return { started: true, draftId: id };
    }
    async getProgress(id, req) {
        await this.service.getStatus(req.user.id, id);
        return this.progressService.get(id) ?? { phase: 'idle' };
    }
    async history(req) {
        return this.service.listHistory(req.user.id);
    }
    async status(id, req) {
        return this.service.getStatus(req.user.id, id);
    }
    async remove(id, req) {
        await this.service.delete(req.user.id, id);
        return { success: true };
    }
};
exports.DraftAnalyzerController = DraftAnalyzerController;
__decorate([
    (0, common_1.Post)('upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: MAX_FILE_BYTES } })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], DraftAnalyzerController.prototype, "upload", null);
__decorate([
    (0, common_1.Post)(':id/extract'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DraftAnalyzerController.prototype, "extract", null);
__decorate([
    (0, common_1.Get)(':id/pages'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DraftAnalyzerController.prototype, "listPages", null);
__decorate([
    (0, common_1.Get)(':id/pages/:pageNum'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('pageNum', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Object]),
    __metadata("design:returntype", Promise)
], DraftAnalyzerController.prototype, "getPage", null);
__decorate([
    (0, common_1.Post)(':id/review'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DraftAnalyzerController.prototype, "review", null);
__decorate([
    (0, common_1.Get)(':id/review'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DraftAnalyzerController.prototype, "getReview", null);
__decorate([
    (0, common_1.Get)(':id/audit-status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DraftAnalyzerController.prototype, "getAuditStatus", null);
__decorate([
    (0, common_1.Get)(':id/file-url'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DraftAnalyzerController.prototype, "fileUrl", null);
__decorate([
    (0, common_1.Get)(':id/file-data'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], DraftAnalyzerController.prototype, "fileData", null);
__decorate([
    (0, common_1.Get)(':id/blocks'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DraftAnalyzerController.prototype, "blocks", null);
__decorate([
    (0, common_1.Post)(':id/analyze'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DraftAnalyzerController.prototype, "analyze", null);
__decorate([
    (0, common_1.Get)(':id/progress'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DraftAnalyzerController.prototype, "getProgress", null);
__decorate([
    (0, common_1.Get)('history'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DraftAnalyzerController.prototype, "history", null);
__decorate([
    (0, common_1.Get)(':id/status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DraftAnalyzerController.prototype, "status", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DraftAnalyzerController.prototype, "remove", null);
exports.DraftAnalyzerController = DraftAnalyzerController = __decorate([
    (0, common_1.Controller)('draft-analyzer'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __metadata("design:paramtypes", [draft_analyzer_service_1.DraftAnalyzerService,
        extraction_service_1.ExtractionService,
        ai_reviewer_service_1.AiReviewerService,
        progress_service_1.ProgressService])
], DraftAnalyzerController);
//# sourceMappingURL=draft-analyzer.controller.js.map
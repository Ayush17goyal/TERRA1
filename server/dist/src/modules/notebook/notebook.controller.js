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
exports.NotebookController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const notebook_service_1 = require("./notebook.service");
const clerk_auth_guard_1 = require("../../guards/clerk-auth.guard");
const settings_service_1 = require("../settings/settings.service");
const axios_1 = require("axios");
const MAX_UPLOAD_BYTES = Number(process.env.MAX_NOTEBOOK_UPLOAD_BYTES || 25 * 1024 * 1024);
const MAX_BULK_FILES = Number(process.env.MAX_NOTEBOOK_BULK_FILES || 50);
const MAX_BULK_BYTES = Number(process.env.MAX_NOTEBOOK_BULK_BYTES || 150 * 1024 * 1024);
let NotebookController = class NotebookController {
    constructor(notebookService, settings) {
        this.notebookService = notebookService;
        this.settings = settings;
    }
    async listDocuments(req) {
        const userId = req.user.id;
        return this.notebookService.listAll(userId);
    }
    async getDocument(id, req) {
        const doc = await this.notebookService.getOneForUser(id, req.user.id);
        if (!doc) {
            throw new common_1.HttpException('Document not found', common_1.HttpStatus.NOT_FOUND);
        }
        return doc;
    }
    async previewDocument(id, req) {
        try {
            return await this.notebookService.getPreview(id, req.user.id);
        }
        catch (error) {
            throw new common_1.HttpException(error.message, common_1.HttpStatus.NOT_FOUND);
        }
    }
    async openDocumentFile(id, req, res) {
        const userId = req.user.id;
        try {
            const { doc, path } = await this.notebookService.getStoredFile(id, userId);
            res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
            res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.name)}"`);
            return res.sendFile(path);
        }
        catch (error) {
            throw new common_1.HttpException(error.message, common_1.HttpStatus.NOT_FOUND);
        }
    }
    async getChunks(id, req) {
        return this.notebookService.getChunksForUserDocument(id, req.user.id);
    }
    async getChatHistory(id, req) {
        const userId = req.user.id;
        return this.notebookService.getChatHistory(userId, id);
    }
    async reprocessDocument(id, req) {
        const userId = req.user.id;
        try {
            return await this.notebookService.reprocess(id, userId);
        }
        catch (error) {
            throw new common_1.HttpException(error.message, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async getExtraction(id, req) {
        const doc = await this.notebookService.getOneForUser(id, req.user.id);
        if (!doc) {
            throw new common_1.HttpException('Document not found', common_1.HttpStatus.NOT_FOUND);
        }
        return doc.legalMetadata || null;
    }
    async runExtraction(id, req) {
        const userId = req.user.id;
        try {
            const result = await this.notebookService.runLegalExtraction(id, userId);
            await this.settings.log({
                userId,
                module: 'Judgment Mastery Engine',
                action: 'Analyzed Judgment',
                metadata: { documentId: id },
            });
            return result;
        }
        catch (error) {
            throw new common_1.HttpException(error.message, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async generateStudyForge(id, req) {
        const userId = req.user.id;
        try {
            const result = await this.notebookService.generateStudyForgeForDocument(id, userId);
            await this.settings.log({
                userId,
                module: 'LexNotebook AI',
                action: 'Generated Study Kit',
                metadata: {
                    documentId: id,
                    flashcards: Array.isArray(result?.flashcards) ? result.flashcards.length : 0,
                    mcqs: Array.isArray(result?.quizQuestions) ? result.quizQuestions.length : 0,
                },
            });
            return result;
        }
        catch (error) {
            throw new common_1.HttpException(error.message, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async rateStudyForgeFlashcard(id, cardId, body, req) {
        const userId = req.user.id;
        try {
            const result = await this.notebookService.rateStudyForgeFlashcard(id, userId, cardId, body.rating);
            await this.settings.log({
                userId,
                module: 'LexNotebook AI',
                action: 'Reviewed Flashcard',
                metadata: { documentId: id, cardId, rating: body.rating },
            });
            return result;
        }
        catch (error) {
            throw new common_1.HttpException(error.message, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async recordStudyForgeQuizAttempt(id, body, req) {
        const userId = req.user.id;
        try {
            const result = await this.notebookService.recordStudyForgeQuizAttempt(id, userId, body.answers || {});
            const attempts = result?.progress?.quizAttempts || [];
            const latestAttempt = attempts[attempts.length - 1] || {};
            await this.settings.log({
                userId,
                module: 'LexNotebook AI',
                action: 'Completed Quiz',
                metadata: { documentId: id, score: latestAttempt.accuracy },
            });
            return result;
        }
        catch (error) {
            throw new common_1.HttpException(error.message, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async getKnowledgeGraph(req, documentId) {
        const userId = req.user.id;
        return this.notebookService.buildKnowledgeGraph(userId, documentId);
    }
    async search(req, q, mode = 'hybrid', documentId) {
        const userId = req.user.id;
        try {
            return await this.notebookService.searchWorkspace(userId, q, mode, documentId);
        }
        catch (error) {
            throw new common_1.HttpException(error.message, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async deleteDocument(id, req) {
        const deleted = await this.notebookService.delete(id, req.user.id);
        if (!deleted) {
            throw new common_1.HttpException('Document could not be deleted', common_1.HttpStatus.BAD_REQUEST);
        }
        return { success: true, message: 'Document deleted successfully' };
    }
    async uploadDocument(file, documentType, req) {
        if (!file) {
            throw new common_1.HttpException('Multipart file payload missing', common_1.HttpStatus.BAD_REQUEST);
        }
        this.validateUploadedFile(file);
        const userId = req.user.id;
        const name = file.originalname;
        const ext = name.split('.').pop()?.toLowerCase() || '';
        if (!this.isSupportedStudyMaterial(ext)) {
            throw new common_1.HttpException('Format not supported. Please upload PDF, DOCX, PPTX, PPT, TXT, MD, CSV, JPG, JPEG, PNG, WEBP, or ZIP files.', common_1.HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        }
        const doc = await this.notebookService.startIngestion(userId, {
            originalname: file.originalname,
            buffer: file.buffer,
            size: file.size,
            mimetype: file.mimetype,
        }, documentType);
        await this.settings.log({
            userId,
            module: /judg(e)?ment/i.test(name) ? 'Judgment Mastery Engine' : 'LexNotebook AI',
            action: /judg(e)?ment/i.test(name) ? 'Uploaded Judgment' : 'Uploaded Document',
            metadata: { documentId: doc.id, name, size: file.size },
        });
        return doc;
    }
    async uploadDocuments(files, req) {
        if (!files?.length) {
            throw new common_1.HttpException('Multipart files payload missing', common_1.HttpStatus.BAD_REQUEST);
        }
        this.validateBulkUpload(files);
        const userId = req.user.id;
        const docs = await this.notebookService.startBulkIngestion(userId, files.map((file) => ({
            originalname: file.originalname,
            buffer: file.buffer,
            size: file.size,
            mimetype: file.mimetype,
        })));
        await this.settings.log({
            userId,
            module: 'LexNotebook AI',
            action: 'Bulk Uploaded Study Material',
            metadata: { count: docs.length },
        });
        return { accepted: docs.length, documents: docs };
    }
    isSupportedStudyMaterial(ext) {
        return ['pdf', 'docx', 'pptx', 'ppt', 'txt', 'md', 'csv', 'jpg', 'jpeg', 'png', 'webp', 'zip'].includes(ext);
    }
    validateUploadedFile(file) {
        if (!file?.buffer || file.size <= 0) {
            throw new common_1.HttpException('Uploaded file is empty.', common_1.HttpStatus.BAD_REQUEST);
        }
        if (file.size > MAX_UPLOAD_BYTES) {
            throw new common_1.HttpException(`File is too large. Maximum allowed size is ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`, common_1.HttpStatus.PAYLOAD_TOO_LARGE);
        }
    }
    validateBulkUpload(files) {
        if (files.length > MAX_BULK_FILES) {
            throw new common_1.HttpException(`Too many files. Maximum allowed files per upload is ${MAX_BULK_FILES}.`, common_1.HttpStatus.PAYLOAD_TOO_LARGE);
        }
        let totalSize = 0;
        for (const file of files) {
            this.validateUploadedFile(file);
            totalSize += Number(file.size || 0);
        }
        if (totalSize > MAX_BULK_BYTES) {
            throw new common_1.HttpException(`Bulk upload is too large. Maximum allowed total size is ${Math.floor(MAX_BULK_BYTES / (1024 * 1024))} MB.`, common_1.HttpStatus.PAYLOAD_TOO_LARGE);
        }
    }
    validateIngestUrl(rawUrl) {
        let parsed;
        try {
            parsed = new URL(rawUrl);
        }
        catch {
            throw new common_1.HttpException('Invalid URL.', common_1.HttpStatus.BAD_REQUEST);
        }
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new common_1.HttpException('Only HTTP and HTTPS URLs are supported.', common_1.HttpStatus.BAD_REQUEST);
        }
        const host = parsed.hostname.toLowerCase();
        const blockedHost = host === 'localhost' || host.endsWith('.localhost') || host === 'metadata.google.internal';
        const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
        if (blockedHost || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') {
            throw new common_1.HttpException('URL host is not allowed.', common_1.HttpStatus.BAD_REQUEST);
        }
        if (ipv4) {
            const a = Number(ipv4[1]);
            const b = Number(ipv4[2]);
            if (a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) {
                throw new common_1.HttpException('Private network URLs are not allowed.', common_1.HttpStatus.BAD_REQUEST);
            }
        }
    }
    async chatStream(body, req, res) {
        if (!body.documentId || !body.message) {
            throw new common_1.HttpException('Missing documentId or message', common_1.HttpStatus.BAD_REQUEST);
        }
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        const userId = req.user.id;
        await this.notebookService.generateRagChatStream(userId, body.documentId, body.message, body.history || [], res);
        await this.settings.log({
            userId,
            module: 'LexNotebook AI',
            action: 'Asked Document Question',
            metadata: { documentId: body.documentId, characters: body.message.length },
        });
    }
    async ingestFromUrl(body, req) {
        if (!body.url) {
            throw new common_1.HttpException('Missing url parameter', common_1.HttpStatus.BAD_REQUEST);
        }
        this.validateIngestUrl(body.url);
        const userId = req.user.id;
        try {
            const response = await axios_1.default.get(body.url, { timeout: 12000, responseType: 'text', maxContentLength: MAX_UPLOAD_BYTES });
            const html = String(response.data || '');
            const text = html
                .replace(/<script[\s\S]*?<\/script>/gi, ' ')
                .replace(/<style[\s\S]*?<\/style>/gi, ' ')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            if (text.length < 20) {
                throw new Error('Not enough text could be extracted from the page.');
            }
            const hostname = new URL(body.url).hostname;
            const originalname = body.name || `Imported_URL_${hostname.replace(/\./g, '_')}.txt`;
            const buffer = Buffer.from(text, 'utf-8');
            const doc = await this.notebookService.startIngestion(userId, {
                originalname,
                buffer,
                size: buffer.length,
                mimetype: 'text/plain',
            });
            await this.settings.log({
                userId,
                module: 'LexNotebook AI',
                action: 'Imported URL Study Material',
                metadata: { documentId: doc.id, url: body.url },
            });
            return doc;
        }
        catch (error) {
            throw new common_1.HttpException(error.message || 'URL ingestion failed', common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async getDocumentIntelligence(id, body, req) {
        const userId = req.user.id;
        try {
            return await this.notebookService.getDocumentIntelligence(id, body.action, userId, body.targetDocumentId);
        }
        catch (error) {
            throw new common_1.HttpException(error.message || 'Document intelligence processing failed', common_1.HttpStatus.BAD_REQUEST);
        }
    }
};
exports.NotebookController = NotebookController;
__decorate([
    (0, common_1.Get)('documents'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotebookController.prototype, "listDocuments", null);
__decorate([
    (0, common_1.Get)('documents/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], NotebookController.prototype, "getDocument", null);
__decorate([
    (0, common_1.Get)('documents/:id/preview'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], NotebookController.prototype, "previewDocument", null);
__decorate([
    (0, common_1.Get)('documents/:id/file'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], NotebookController.prototype, "openDocumentFile", null);
__decorate([
    (0, common_1.Get)('documents/:id/chunks'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], NotebookController.prototype, "getChunks", null);
__decorate([
    (0, common_1.Get)('documents/:id/chat-history'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], NotebookController.prototype, "getChatHistory", null);
__decorate([
    (0, common_1.Post)('documents/:id/reprocess'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], NotebookController.prototype, "reprocessDocument", null);
__decorate([
    (0, common_1.Get)('documents/:id/extraction'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], NotebookController.prototype, "getExtraction", null);
__decorate([
    (0, common_1.Post)('documents/:id/extraction'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], NotebookController.prototype, "runExtraction", null);
__decorate([
    (0, common_1.Post)('documents/:id/study-forge/generate'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], NotebookController.prototype, "generateStudyForge", null);
__decorate([
    (0, common_1.Post)('documents/:id/study-forge/flashcards/:cardId/rate'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('cardId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], NotebookController.prototype, "rateStudyForgeFlashcard", null);
__decorate([
    (0, common_1.Post)('documents/:id/study-forge/quiz-attempt'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], NotebookController.prototype, "recordStudyForgeQuizAttempt", null);
__decorate([
    (0, common_1.Get)('graph'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('documentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], NotebookController.prototype, "getKnowledgeGraph", null);
__decorate([
    (0, common_1.Get)('search'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('q')),
    __param(2, (0, common_1.Query)('mode')),
    __param(3, (0, common_1.Query)('documentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], NotebookController.prototype, "search", null);
__decorate([
    (0, common_1.Delete)('documents/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], NotebookController.prototype, "deleteDocument", null);
__decorate([
    (0, common_1.Post)('upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: MAX_UPLOAD_BYTES } })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)('documentType')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], NotebookController.prototype, "uploadDocument", null);
__decorate([
    (0, common_1.Post)('bulk-upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', MAX_BULK_FILES, { limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_BULK_FILES } })),
    __param(0, (0, common_1.UploadedFiles)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object]),
    __metadata("design:returntype", Promise)
], NotebookController.prototype, "uploadDocuments", null);
__decorate([
    (0, common_1.Post)('chat'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], NotebookController.prototype, "chatStream", null);
__decorate([
    (0, common_1.Post)('url-ingest'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], NotebookController.prototype, "ingestFromUrl", null);
__decorate([
    (0, common_1.Post)('documents/:id/intelligence'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], NotebookController.prototype, "getDocumentIntelligence", null);
exports.NotebookController = NotebookController = __decorate([
    (0, common_1.Controller)('notebook'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __metadata("design:paramtypes", [notebook_service_1.NotebookService,
        settings_service_1.SettingsService])
], NotebookController);
//# sourceMappingURL=notebook.controller.js.map
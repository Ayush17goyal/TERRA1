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
var DraftAnalyzerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DraftAnalyzerService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const draft_entity_1 = require("./entities/draft.entity");
const supabase_service_1 = require("../settings/supabase.service");
const progress_service_1 = require("./services/progress.service");
const extraction_service_1 = require("./services/extraction.service");
const ai_reviewer_service_1 = require("./services/ai-reviewer.service");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require("os");
const MAX_FILE_BYTES = Number(process.env.DRAFT_ANALYZER_MAX_BYTES || 25 * 1024 * 1024);
const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
]);
const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx', 'txt']);
const STORAGE_BUCKET = 'draft-analyzer-files';
function resolveLocalDraftDir() {
    const candidates = [
        process.env.SQLITE_DB_PATH ? path.join(path.dirname(process.env.SQLITE_DB_PATH), 'draft-files') : null,
        '/var/data/draft-files',
        path.join(process.env.LOCALAPPDATA || os.homedir(), 'LEGATRIXON', 'draft-files'),
        path.join(os.tmpdir(), 'LEGATRIXON', 'draft-files'),
    ].filter(Boolean);
    for (const dir of candidates) {
        try {
            fs.mkdirSync(dir, { recursive: true });
            fs.accessSync(dir, fs.constants.W_OK);
            return dir;
        }
        catch {
        }
    }
    throw new Error('Cannot find a writable directory for local draft file storage.');
}
const LOCAL_DRAFT_DIR = resolveLocalDraftDir();
let DraftAnalyzerService = DraftAnalyzerService_1 = class DraftAnalyzerService {
    constructor(draftRepo, supabaseService, progressService, extractionService, aiReviewer) {
        this.draftRepo = draftRepo;
        this.supabaseService = supabaseService;
        this.progressService = progressService;
        this.extractionService = extractionService;
        this.aiReviewer = aiReviewer;
        this.logger = new common_1.Logger(DraftAnalyzerService_1.name);
        this.logger.log(`Local draft file storage: ${LOCAL_DRAFT_DIR}`);
    }
    async upload(userId, file) {
        this.validateFile(file);
        const draftId = crypto.randomUUID();
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const supabasePath = `drafts/${userId}/${draftId}/${safeName}`;
        let resolvedStoragePath;
        if (this.supabaseService.isConfigured()) {
            try {
                resolvedStoragePath = await this.supabaseService.uploadFileToStorage(STORAGE_BUCKET, supabasePath, file.buffer, file.mimetype);
                this.logger.log(`Draft ${draftId} stored in Supabase at ${resolvedStoragePath}`);
            }
            catch (err) {
                this.logger.warn(`Supabase upload failed for ${draftId}: ${err.message}. Falling back to local disk.`);
                resolvedStoragePath = this.saveToLocalDisk(draftId, safeName, file.buffer);
            }
        }
        else {
            resolvedStoragePath = this.saveToLocalDisk(draftId, safeName, file.buffer);
            this.logger.log(`Draft ${draftId} stored on local disk at ${resolvedStoragePath}`);
        }
        const draft = this.draftRepo.create({
            id: draftId,
            userId,
            fileName: file.originalname,
            fileSize: file.size,
            mimeType: file.mimetype,
            storagePath: resolvedStoragePath,
            status: 'pending',
        });
        await this.draftRepo.save(draft);
        this.logger.log(`Draft record created: id=${draftId} user=${userId} file=${file.originalname}`);
        return draft;
    }
    async getStatus(userId, draftId) {
        const draft = await this.draftRepo.findOne({ where: { id: draftId, userId } });
        if (!draft)
            throw new common_1.HttpException('Draft not found', common_1.HttpStatus.NOT_FOUND);
        return draft;
    }
    async listHistory(userId) {
        return this.draftRepo.find({
            where: { userId },
            order: { createdAt: 'DESC' },
        });
    }
    async getFileUrl(userId, draftId) {
        const draft = await this.draftRepo.findOne({ where: { id: draftId, userId } });
        if (!draft)
            throw new common_1.HttpException('Draft not found', common_1.HttpStatus.NOT_FOUND);
        if (draft.storagePath?.startsWith('supabase://')) {
            const withoutScheme = draft.storagePath.slice('supabase://'.length);
            const slashIdx = withoutScheme.indexOf('/');
            const bucket = withoutScheme.slice(0, slashIdx);
            const filePath = withoutScheme.slice(slashIdx + 1);
            const url = await this.supabaseService.getSignedUrl(bucket, filePath);
            return { url, fileName: draft.fileName, mimeType: draft.mimeType };
        }
        if (draft.storagePath?.startsWith('local://')) {
            return { url: null, localFile: true, fileName: draft.fileName, mimeType: draft.mimeType };
        }
        return { url: null, fileName: draft.fileName, mimeType: draft.mimeType };
    }
    async getFileData(userId, draftId) {
        const draft = await this.draftRepo.findOne({ where: { id: draftId, userId } });
        if (!draft)
            throw new common_1.HttpException('Draft not found', common_1.HttpStatus.NOT_FOUND);
        if (!draft.storagePath?.startsWith('local://')) {
            throw new common_1.HttpException('File is not stored locally.', common_1.HttpStatus.BAD_REQUEST);
        }
        const filePath = draft.storagePath.slice('local://'.length);
        if (!fs.existsSync(filePath)) {
            throw new common_1.HttpException('Local file not found. Please re-upload the draft.', common_1.HttpStatus.NOT_FOUND);
        }
        const buffer = fs.readFileSync(filePath);
        return { buffer, mimeType: draft.mimeType };
    }
    async analyzeInBackground(draftId, userId) {
        this.progressService.init(draftId);
        try {
            this.progressService.startPipelineStage(draftId, 'extraction', 'Extracting document text…');
            try {
                await this.extractionService.extractWithProgress(draftId, userId, patch => this.progressService.update(draftId, patch));
                this.progressService.finishPipelineStage(draftId, 'extraction', 'success', 'Document extracted');
            }
            catch (extractErr) {
                this.progressService.finishPipelineStage(draftId, 'extraction', 'failed', `Extraction failed: ${extractErr.message}`);
                this.progressService.setCompletionStatus(draftId, 'failed', `Extraction failed: ${extractErr.message}`);
                this.logger.error(`[${draftId}] Extraction failed: ${extractErr.message}`);
                return;
            }
            this.progressService.update(draftId, {
                phase: 'reviewing',
                extractPct: 100,
                reviewPct: 0,
                message: 'Extraction complete — starting 8-stage audit…',
            });
            const result = await this.aiReviewer.reviewWithProgress(draftId, userId, patch => this.progressService.update(draftId, patch));
            const hasTimeouts = this.progressService.get(draftId)?.hasTimeouts ?? false;
            const completionStatus = hasTimeouts ? 'complete_with_warnings' : 'complete';
            const completionMsg = hasTimeouts
                ? `Analysis Completed with Warnings — ${result.findingCount} finding(s), score ${result.auditScore}/100`
                : `Analysis Complete — ${result.findingCount} finding(s), score ${result.auditScore}/100`;
            this.progressService.setCompletionStatus(draftId, completionStatus, completionMsg);
            this.progressService.update(draftId, {
                phase: 'done',
                reviewPct: 100,
                message: completionMsg,
                completedAt: Date.now(),
            });
        }
        catch (err) {
            this.logger.error(`Background analyze failed for draft ${draftId}: ${err.message}`);
            this.progressService.setCompletionStatus(draftId, 'failed', `Analysis Failed: ${err.message}`);
            this.progressService.update(draftId, {
                phase: 'error',
                error: err.message,
                message: `Analysis Failed: ${err.message}`,
                completedAt: Date.now(),
            });
        }
    }
    async delete(userId, draftId) {
        const draft = await this.draftRepo.findOne({ where: { id: draftId, userId } });
        if (!draft)
            throw new common_1.HttpException('Draft not found', common_1.HttpStatus.NOT_FOUND);
        if (draft.storagePath?.startsWith('local://')) {
            try {
                fs.unlinkSync(draft.storagePath.slice('local://'.length));
            }
            catch { }
        }
        await this.draftRepo.remove(draft);
    }
    saveToLocalDisk(draftId, safeName, buffer) {
        const dir = path.join(LOCAL_DRAFT_DIR, draftId);
        fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, safeName);
        fs.writeFileSync(filePath, buffer);
        return `local://${filePath}`;
    }
    validateFile(file) {
        if (!file?.buffer || file.size <= 0) {
            throw new common_1.HttpException('Uploaded file is empty.', common_1.HttpStatus.BAD_REQUEST);
        }
        if (file.size > MAX_FILE_BYTES) {
            const mb = Math.floor(MAX_FILE_BYTES / (1024 * 1024));
            throw new common_1.HttpException(`File too large. Maximum size is ${mb} MB.`, common_1.HttpStatus.PAYLOAD_TOO_LARGE);
        }
        const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
        if (!ALLOWED_EXTENSIONS.has(ext)) {
            throw new common_1.HttpException('Unsupported file type. Please upload a PDF, DOCX, or TXT file.', common_1.HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        }
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
            throw new common_1.HttpException('Invalid MIME type. Only PDF, DOCX, and TXT files are accepted.', common_1.HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        }
    }
};
exports.DraftAnalyzerService = DraftAnalyzerService;
exports.DraftAnalyzerService = DraftAnalyzerService = DraftAnalyzerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(draft_entity_1.Draft)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        supabase_service_1.SupabaseService,
        progress_service_1.ProgressService,
        extraction_service_1.ExtractionService,
        ai_reviewer_service_1.AiReviewerService])
], DraftAnalyzerService);
//# sourceMappingURL=draft-analyzer.service.js.map
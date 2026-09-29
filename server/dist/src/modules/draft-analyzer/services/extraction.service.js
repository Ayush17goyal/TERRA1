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
var ExtractionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtractionService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const axios_1 = require("axios");
const crypto = require("crypto");
const fs = require("fs");
const draft_entity_1 = require("../entities/draft.entity");
const draft_page_entity_1 = require("../entities/draft-page.entity");
const draft_text_block_entity_1 = require("../entities/draft-text-block.entity");
const supabase_service_1 = require("../../settings/supabase.service");
const pdf_extractor_service_1 = require("./pdf-extractor.service");
const docx_extractor_service_1 = require("./docx-extractor.service");
const txt_extractor_service_1 = require("./txt-extractor.service");
const PDF_MIME = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const TXT_MIME = 'text/plain';
const PAGE_BATCH_SIZE = 20;
let ExtractionService = ExtractionService_1 = class ExtractionService {
    constructor(draftRepo, pageRepo, blockRepo, supabaseService, pdfExtractor, docxExtractor, txtExtractor, dataSource) {
        this.draftRepo = draftRepo;
        this.pageRepo = pageRepo;
        this.blockRepo = blockRepo;
        this.supabaseService = supabaseService;
        this.pdfExtractor = pdfExtractor;
        this.docxExtractor = docxExtractor;
        this.txtExtractor = txtExtractor;
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(ExtractionService_1.name);
    }
    async extract(draftId, userId) {
        return this.extractWithProgress(draftId, userId, () => { });
    }
    async extractWithProgress(draftId, userId, onProgress) {
        const draft = await this.draftRepo.findOne({ where: { id: draftId, userId } });
        if (!draft)
            throw new common_1.HttpException('Draft not found', common_1.HttpStatus.NOT_FOUND);
        onProgress({ phase: 'extracting', extractPct: 5, message: 'Downloading document…' });
        let buffer = await this.downloadFile(draft);
        onProgress({ extractPct: 15, message: 'Parsing document structure…' });
        const pages = await this.runExtractor(buffer, draft.mimeType, draft.fileName);
        buffer = null;
        this.logger.log(`Extracted ${pages.length} pages from draft ${draftId}`);
        onProgress({ extractPct: 30, message: `Extracted ${pages.length} pages — saving to database…` });
        await this.persistExtractionStreaming(draft, pages, (savedPages, totalPages) => {
            const pct = 30 + Math.round((savedPages / totalPages) * 65);
            onProgress({ extractPct: pct, message: `Saved ${savedPages}/${totalPages} pages…` });
        });
        onProgress({ extractPct: 100, message: `Extraction complete — ${pages.length} pages` });
        return {
            draftId,
            pageCount: pages.length,
            totalBlocks: pages.reduce((s, p) => s + p.blocks.length, 0),
            pages,
        };
    }
    async getPages(draftId, userId) {
        await this.assertDraftOwner(draftId, userId);
        return this.pageRepo.find({ where: { draftId }, order: { pageNumber: 'ASC' } });
    }
    async getAllLineBlocks(draftId, userId) {
        await this.assertDraftOwner(draftId, userId);
        return this.blockRepo.find({
            where: { draftId, blockType: 'line' },
            order: { pageNumber: 'ASC', blockIndex: 'ASC' },
            select: ['id', 'pageNumber', 'blockIndex', 'textContent', 'x', 'y', 'width', 'height', 'fontSize'],
        });
    }
    async getPage(draftId, userId, pageNumber) {
        await this.assertDraftOwner(draftId, userId);
        const page = await this.pageRepo.findOne({ where: { draftId, pageNumber } });
        if (!page)
            throw new common_1.HttpException('Page not found', common_1.HttpStatus.NOT_FOUND);
        const blocks = await this.blockRepo.find({ where: { pageId: page.id }, order: { blockIndex: 'ASC' } });
        return { page, blocks };
    }
    async assertDraftOwner(draftId, userId) {
        const draft = await this.draftRepo.findOne({ where: { id: draftId, userId } });
        if (!draft)
            throw new common_1.HttpException('Draft not found', common_1.HttpStatus.NOT_FOUND);
        return draft;
    }
    async downloadFile(draft) {
        const uri = draft.storagePath;
        if (uri?.startsWith('local://')) {
            const filePath = uri.slice('local://'.length);
            if (!fs.existsSync(filePath)) {
                throw new common_1.HttpException('Local file not found. Please re-upload the draft.', common_1.HttpStatus.UNPROCESSABLE_ENTITY);
            }
            this.logger.log(`Reading local draft file: ${filePath}`);
            return fs.readFileSync(filePath);
        }
        if (uri?.startsWith('supabase://')) {
            const withoutScheme = uri.slice('supabase://'.length);
            const slashIdx = withoutScheme.indexOf('/');
            const bucket = withoutScheme.slice(0, slashIdx);
            const filePath = withoutScheme.slice(slashIdx + 1);
            const url = `${this.supabaseService.supabaseUrl}/storage/v1/object/${bucket}/${filePath}`;
            this.logger.log(`Downloading draft file from Supabase: ${url}`);
            try {
                const res = await axios_1.default.get(url, {
                    headers: this.supabaseService.getHeaders(),
                    responseType: 'arraybuffer',
                    timeout: 60_000,
                });
                return Buffer.from(res.data);
            }
            catch (err) {
                throw new common_1.HttpException(`Failed to download draft file (HTTP ${err.response?.status ?? 'network error'}).`, common_1.HttpStatus.BAD_GATEWAY);
            }
        }
        throw new common_1.HttpException('File location unknown. Please re-upload the draft.', common_1.HttpStatus.UNPROCESSABLE_ENTITY);
    }
    async runExtractor(buffer, mimeType, fileName) {
        const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
        if (mimeType === PDF_MIME || ext === 'pdf')
            return this.pdfExtractor.extract(buffer);
        if (mimeType === DOCX_MIME || ext === 'docx')
            return this.docxExtractor.extract(buffer);
        if (mimeType === TXT_MIME || ext === 'txt')
            return this.txtExtractor.extract(buffer);
        throw new common_1.HttpException(`Unsupported MIME type: ${mimeType}`, common_1.HttpStatus.UNPROCESSABLE_ENTITY);
    }
    async persistExtractionStreaming(draft, pages, onBatch) {
        {
            const qr = this.dataSource.createQueryRunner();
            await qr.connect();
            await qr.startTransaction();
            try {
                await qr.manager.delete(draft_text_block_entity_1.DraftTextBlock, { draftId: draft.id });
                await qr.manager.delete(draft_page_entity_1.DraftPage, { draftId: draft.id });
                await qr.commitTransaction();
            }
            catch (err) {
                await qr.rollbackTransaction();
                throw new common_1.HttpException(`Failed to clear old extraction: ${err.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
            }
            finally {
                await qr.release();
            }
        }
        let saved = 0;
        for (let start = 0; start < pages.length; start += PAGE_BATCH_SIZE) {
            const chunk = pages.slice(start, start + PAGE_BATCH_SIZE);
            await this.persistPageChunk(draft, chunk);
            saved += chunk.length;
            onBatch(saved, pages.length);
        }
        await this.draftRepo.update({ id: draft.id }, {
            extractedAt: new Date(),
            status: 'processing',
        });
    }
    async persistPageChunk(draft, pages) {
        const BLOCK_CHUNK = 50;
        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();
        try {
            for (const pd of pages) {
                const pageId = crypto.randomUUID();
                await qr.manager.insert(draft_page_entity_1.DraftPage, {
                    id: pageId,
                    draftId: draft.id,
                    pageNumber: pd.pageNumber,
                    widthPt: pd.widthPt,
                    heightPt: pd.heightPt,
                    rawText: pd.rawText,
                    blockCount: pd.blocks.length,
                });
                for (let i = 0; i < pd.blocks.length; i += BLOCK_CHUNK) {
                    const slice = pd.blocks.slice(i, i + BLOCK_CHUNK).map(b => ({
                        id: crypto.randomUUID(),
                        draftId: draft.id,
                        pageId,
                        pageNumber: pd.pageNumber,
                        blockType: b.blockType,
                        blockIndex: b.blockIndex,
                        paragraphIndex: b.paragraphIndex,
                        lineIndex: b.lineIndex ?? null,
                        textContent: b.textContent,
                        x: b.x, y: b.y, width: b.width, height: b.height,
                        fontSize: b.fontSize ?? null,
                        fontName: b.fontName ?? null,
                        isBold: b.isBold,
                        isItalic: b.isItalic,
                    }));
                    await qr.manager.insert(draft_text_block_entity_1.DraftTextBlock, slice);
                }
            }
            await qr.commitTransaction();
        }
        catch (err) {
            await qr.rollbackTransaction();
            this.logger.error(`Page chunk persist failed: ${err.message}`);
            throw new common_1.HttpException('Failed to save extraction results.', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
        finally {
            await qr.release();
        }
    }
};
exports.ExtractionService = ExtractionService;
exports.ExtractionService = ExtractionService = ExtractionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(draft_entity_1.Draft)),
    __param(1, (0, typeorm_1.InjectRepository)(draft_page_entity_1.DraftPage)),
    __param(2, (0, typeorm_1.InjectRepository)(draft_text_block_entity_1.DraftTextBlock)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        supabase_service_1.SupabaseService,
        pdf_extractor_service_1.PdfExtractorService,
        docx_extractor_service_1.DocxExtractorService,
        txt_extractor_service_1.TxtExtractorService,
        typeorm_2.DataSource])
], ExtractionService);
//# sourceMappingURL=extraction.service.js.map
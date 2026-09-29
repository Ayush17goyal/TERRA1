import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';

import { Draft } from '../entities/draft.entity';
import { DraftPage } from '../entities/draft-page.entity';
import { DraftTextBlock } from '../entities/draft-text-block.entity';
import { SupabaseService } from '../../settings/supabase.service';
import { PdfExtractorService } from './pdf-extractor.service';
import { DocxExtractorService } from './docx-extractor.service';
import { TxtExtractorService } from './txt-extractor.service';
import type { ExtractionResult, PageData } from './extraction.types';
import type { JobProgress } from './progress.service';

const PDF_MIME  = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const TXT_MIME  = 'text/plain';

// Pages persisted per transaction — keeps each transaction small for large docs
const PAGE_BATCH_SIZE = 20;

type ProgressCb = (patch: Partial<JobProgress>) => void;

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);

  constructor(
    @InjectRepository(Draft)
    private readonly draftRepo: Repository<Draft>,
    @InjectRepository(DraftPage)
    private readonly pageRepo: Repository<DraftPage>,
    @InjectRepository(DraftTextBlock)
    private readonly blockRepo: Repository<DraftTextBlock>,
    private readonly supabaseService: SupabaseService,
    private readonly pdfExtractor: PdfExtractorService,
    private readonly docxExtractor: DocxExtractorService,
    private readonly txtExtractor: TxtExtractorService,
    private readonly dataSource: DataSource,
  ) {}

  // ─── public API ────────────────────────────────────────────────────────────

  /** Legacy sync entry-point — still works; just no rich progress. */
  async extract(draftId: string, userId: string): Promise<ExtractionResult> {
    return this.extractWithProgress(draftId, userId, () => {});
  }

  /** Background-job entry-point with progress callbacks. */
  async extractWithProgress(
    draftId: string,
    userId: string,
    onProgress: ProgressCb,
  ): Promise<ExtractionResult> {
    const draft = await this.draftRepo.findOne({ where: { id: draftId, userId } });
    if (!draft) throw new HttpException('Draft not found', HttpStatus.NOT_FOUND);

    onProgress({ phase: 'extracting', extractPct: 5, message: 'Downloading document…' });

    // 1. Download — release buffer reference after extraction so GC can reclaim it
    let buffer: Buffer | null = await this.downloadFile(draft);

    onProgress({ extractPct: 15, message: 'Parsing document structure…' });

    // 2. Extract
    const pages = await this.runExtractor(buffer, draft.mimeType, draft.fileName);
    buffer = null; // release — no longer needed

    this.logger.log(`Extracted ${pages.length} pages from draft ${draftId}`);
    onProgress({ extractPct: 30, message: `Extracted ${pages.length} pages — saving to database…` });

    // 3. Persist in streaming batches of PAGE_BATCH_SIZE
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

  async getPages(draftId: string, userId: string): Promise<DraftPage[]> {
    await this.assertDraftOwner(draftId, userId);
    return this.pageRepo.find({ where: { draftId }, order: { pageNumber: 'ASC' } });
  }

  async getAllLineBlocks(draftId: string, userId: string): Promise<DraftTextBlock[]> {
    await this.assertDraftOwner(draftId, userId);
    return this.blockRepo.find({
      where: { draftId, blockType: 'line' as any },
      order: { pageNumber: 'ASC', blockIndex: 'ASC' },
      select: ['id', 'pageNumber', 'blockIndex', 'textContent', 'x', 'y', 'width', 'height', 'fontSize'],
    });
  }

  async getPage(draftId: string, userId: string, pageNumber: number): Promise<{ page: DraftPage; blocks: DraftTextBlock[] }> {
    await this.assertDraftOwner(draftId, userId);
    const page = await this.pageRepo.findOne({ where: { draftId, pageNumber } });
    if (!page) throw new HttpException('Page not found', HttpStatus.NOT_FOUND);
    const blocks = await this.blockRepo.find({ where: { pageId: page.id }, order: { blockIndex: 'ASC' } });
    return { page, blocks };
  }

  // ─── internals ─────────────────────────────────────────────────────────────

  private async assertDraftOwner(draftId: string, userId: string) {
    const draft = await this.draftRepo.findOne({ where: { id: draftId, userId } });
    if (!draft) throw new HttpException('Draft not found', HttpStatus.NOT_FOUND);
    return draft;
  }

  private async downloadFile(draft: Draft): Promise<Buffer> {
    const uri = draft.storagePath;

    // ── Local disk file (Supabase disabled / unavailable fallback) ─────────────
    if (uri?.startsWith('local://')) {
      const filePath = uri.slice('local://'.length);
      if (!fs.existsSync(filePath)) {
        throw new HttpException(
          'Local file not found. Please re-upload the draft.',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      this.logger.log(`Reading local draft file: ${filePath}`);
      return fs.readFileSync(filePath);
    }

    // ── Supabase Storage download ──────────────────────────────────────────────
    if (uri?.startsWith('supabase://')) {
      const withoutScheme = uri.slice('supabase://'.length);
      const slashIdx = withoutScheme.indexOf('/');
      const bucket = withoutScheme.slice(0, slashIdx);
      const filePath = withoutScheme.slice(slashIdx + 1);
      const url = `${this.supabaseService.supabaseUrl}/storage/v1/object/${bucket}/${filePath}`;

      this.logger.log(`Downloading draft file from Supabase: ${url}`);
      try {
        const res = await axios.get<ArrayBuffer>(url, {
          headers: this.supabaseService.getHeaders(),
          responseType: 'arraybuffer',
          timeout: 60_000,
        });
        return Buffer.from(res.data);
      } catch (err: any) {
        throw new HttpException(
          `Failed to download draft file (HTTP ${err.response?.status ?? 'network error'}).`,
          HttpStatus.BAD_GATEWAY,
        );
      }
    }

    throw new HttpException(
      'File location unknown. Please re-upload the draft.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  private async runExtractor(buffer: Buffer, mimeType: string, fileName: string): Promise<PageData[]> {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    if (mimeType === PDF_MIME  || ext === 'pdf')  return this.pdfExtractor.extract(buffer);
    if (mimeType === DOCX_MIME || ext === 'docx') return this.docxExtractor.extract(buffer);
    if (mimeType === TXT_MIME  || ext === 'txt')  return this.txtExtractor.extract(buffer);
    throw new HttpException(`Unsupported MIME type: ${mimeType}`, HttpStatus.UNPROCESSABLE_ENTITY);
  }

  /**
   * Stream pages to the DB in batches of PAGE_BATCH_SIZE.
   * Each batch is its own transaction — avoids one giant lock for 300+ pages.
   */
  private async persistExtractionStreaming(
    draft: Draft,
    pages: PageData[],
    onBatch: (savedSoFar: number, total: number) => void,
  ): Promise<void> {
    // 1. Wipe prior extraction
    {
      const qr = this.dataSource.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();
      try {
        await qr.manager.delete(DraftTextBlock, { draftId: draft.id });
        await qr.manager.delete(DraftPage, { draftId: draft.id });
        await qr.commitTransaction();
      } catch (err: any) {
        await qr.rollbackTransaction();
        throw new HttpException(`Failed to clear old extraction: ${err.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
      } finally {
        await qr.release();
      }
    }

    // 2. Insert pages in streaming batches
    let saved = 0;
    for (let start = 0; start < pages.length; start += PAGE_BATCH_SIZE) {
      const chunk = pages.slice(start, start + PAGE_BATCH_SIZE);
      await this.persistPageChunk(draft, chunk);
      saved += chunk.length;
      onBatch(saved, pages.length);
    }

    // 3. Mark draft as extracted
    await this.draftRepo.update({ id: draft.id }, {
      extractedAt: new Date(),
      status: 'processing',
    });
  }

  private async persistPageChunk(draft: Draft, pages: PageData[]): Promise<void> {
    const BLOCK_CHUNK = 50;
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      for (const pd of pages) {
        const pageId = crypto.randomUUID();
        await qr.manager.insert(DraftPage, {
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
          await qr.manager.insert(DraftTextBlock, slice);
        }
      }
      await qr.commitTransaction();
    } catch (err: any) {
      await qr.rollbackTransaction();
      this.logger.error(`Page chunk persist failed: ${err.message}`);
      throw new HttpException('Failed to save extraction results.', HttpStatus.INTERNAL_SERVER_ERROR);
    } finally {
      await qr.release();
    }
  }
}

import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpException,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { DraftAnalyzerService } from './draft-analyzer.service';
import { ExtractionService } from './services/extraction.service';
import { AiReviewerService } from './services/ai-reviewer.service';
import { ProgressService } from './services/progress.service';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';

const MAX_FILE_BYTES = Number(process.env.DRAFT_ANALYZER_MAX_BYTES || 25 * 1024 * 1024);

@Controller('draft-analyzer')
@UseGuards(ClerkAuthGuard)
export class DraftAnalyzerController {
  constructor(
    private readonly service: DraftAnalyzerService,
    private readonly extractionService: ExtractionService,
    private readonly aiReviewer: AiReviewerService,
    private readonly progressService: ProgressService,
  ) {}

  // ── Upload ────────────────────────────────────────────────────────────────

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  async upload(@UploadedFile() file: any, @Req() req: any) {
    if (!file) throw new HttpException('No file provided.', HttpStatus.BAD_REQUEST);
    return this.service.upload(req.user.id, {
      originalname: file.originalname,
      buffer: file.buffer,
      size: file.size,
      mimetype: file.mimetype,
    });
  }

  // ── Extraction ────────────────────────────────────────────────────────────

  /** Trigger full extraction for a previously uploaded draft. */
  @Post(':id/extract')
  async extract(@Param('id') id: string, @Req() req: any) {
    return this.extractionService.extract(id, req.user.id);
  }

  /** List all pages (metadata only, no blocks) for a draft. */
  @Get(':id/pages')
  async listPages(@Param('id') id: string, @Req() req: any) {
    return this.extractionService.getPages(id, req.user.id);
  }

  /** Get a single page with all its text blocks. */
  @Get(':id/pages/:pageNum')
  async getPage(
    @Param('id') id: string,
    @Param('pageNum', ParseIntPipe) pageNum: number,
    @Req() req: any,
  ) {
    return this.extractionService.getPage(id, req.user.id, pageNum);
  }

  // ── AI Review ─────────────────────────────────────────────────────────────

  /** Run full AI legal review. Requires extraction to have been run first. */
  @Post(':id/review')
  async review(@Param('id') id: string, @Req() req: any) {
    return this.aiReviewer.review(id, req.user.id);
  }

  /** Fetch stored review findings for a draft. */
  @Get(':id/review')
  async getReview(@Param('id') id: string, @Req() req: any) {
    return this.aiReviewer.getFindings(id, req.user.id);
  }

  /**
   * Returns the 8-stage audit validation status and score readiness.
   * Frontend polls this to know when the score can be displayed.
   */
  @Get(':id/audit-status')
  async getAuditStatus(@Param('id') id: string, @Req() req: any) {
    return this.aiReviewer.getAuditStatus(id, req.user.id);
  }

  // ── Annotation Engine ─────────────────────────────────────────────────────

  /** Return a short-lived signed URL for the stored draft file. */
  @Get(':id/file-url')
  async fileUrl(@Param('id') id: string, @Req() req: any) {
    return this.service.getFileUrl(req.user.id, id);
  }

  /** Serve raw file bytes from local DB (used when Supabase Storage is disabled). */
  @Get(':id/file-data')
  async fileData(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    const { buffer, mimeType } = await this.service.getFileData(req.user.id, id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.end(buffer);
  }

  /** Return all line-level text blocks for the annotation layer (x/y/w/h per page). */
  @Get(':id/blocks')
  async blocks(@Param('id') id: string, @Req() req: any) {
    return this.extractionService.getAllLineBlocks(id, req.user.id);
  }

  // ── Background pipeline (optimized for 300+ pages) ───────────────────────

  /**
   * Starts full extract→review pipeline in the background.
   * Returns immediately. Poll GET :id/progress for status.
   */
  @Post(':id/analyze')
  async analyze(@Param('id') id: string, @Req() req: any) {
    // Verify ownership before kicking off background work
    await this.service.getStatus(req.user.id, id);
    // Fire-and-forget — do NOT await
    this.service.analyzeInBackground(id, req.user.id).catch(() => {});
    return { started: true, draftId: id };
  }

  /** Returns the current job progress for polling. */
  @Get(':id/progress')
  async getProgress(@Param('id') id: string, @Req() req: any) {
    await this.service.getStatus(req.user.id, id); // ownership check
    return this.progressService.get(id) ?? { phase: 'idle' };
  }

  // ── History / status / delete ─────────────────────────────────────────────

  @Get('history')
  async history(@Req() req: any) {
    return this.service.listHistory(req.user.id);
  }

  @Get(':id/status')
  async status(@Param('id') id: string, @Req() req: any) {
    return this.service.getStatus(req.user.id, id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    await this.service.delete(req.user.id, id);
    return { success: true };
  }
}

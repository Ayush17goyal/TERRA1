import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Draft } from './entities/draft.entity';
import { SupabaseService } from '../settings/supabase.service';
import { ProgressService } from './services/progress.service';
import { ExtractionService } from './services/extraction.service';
import { AiReviewerService } from './services/ai-reviewer.service';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const MAX_FILE_BYTES = Number(process.env.DRAFT_ANALYZER_MAX_BYTES || 25 * 1024 * 1024);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);
const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx', 'txt']);
const STORAGE_BUCKET = 'draft-analyzer-files';

/** Local disk directory for draft files when Supabase Storage is unavailable. */
function resolveLocalDraftDir(): string {
  // On Render: /var/data is persistent disk. Locally: next to the SQLite DB dir.
  const candidates = [
    process.env.SQLITE_DB_PATH ? path.join(path.dirname(process.env.SQLITE_DB_PATH), 'draft-files') : null,
    '/var/data/draft-files',
    path.join(process.env.LOCALAPPDATA || os.homedir(), 'LEGATRIXON', 'draft-files'),
    path.join(os.tmpdir(), 'LEGATRIXON', 'draft-files'),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {
      // try next
    }
  }
  throw new Error('Cannot find a writable directory for local draft file storage.');
}

const LOCAL_DRAFT_DIR = resolveLocalDraftDir();

@Injectable()
export class DraftAnalyzerService {
  private readonly logger = new Logger(DraftAnalyzerService.name);

  constructor(
    @InjectRepository(Draft)
    private readonly draftRepo: Repository<Draft>,
    private readonly supabaseService: SupabaseService,
    private readonly progressService: ProgressService,
    private readonly extractionService: ExtractionService,
    private readonly aiReviewer: AiReviewerService,
  ) {
    this.logger.log(`Local draft file storage: ${LOCAL_DRAFT_DIR}`);
  }

  async upload(
    userId: string,
    file: { originalname: string; buffer: Buffer; size: number; mimetype: string },
  ): Promise<Draft> {
    this.validateFile(file);

    const draftId = crypto.randomUUID();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const supabasePath = `drafts/${userId}/${draftId}/${safeName}`;

    let resolvedStoragePath: string;

    if (this.supabaseService.isConfigured()) {
      try {
        resolvedStoragePath = await this.supabaseService.uploadFileToStorage(
          STORAGE_BUCKET,
          supabasePath,
          file.buffer,
          file.mimetype,
        );
        this.logger.log(`Draft ${draftId} stored in Supabase at ${resolvedStoragePath}`);
      } catch (err: any) {
        this.logger.warn(`Supabase upload failed for ${draftId}: ${err.message}. Falling back to local disk.`);
        resolvedStoragePath = this.saveToLocalDisk(draftId, safeName, file.buffer);
      }
    } else {
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

  async getStatus(userId: string, draftId: string): Promise<Draft> {
    const draft = await this.draftRepo.findOne({ where: { id: draftId, userId } });
    if (!draft) throw new HttpException('Draft not found', HttpStatus.NOT_FOUND);
    return draft;
  }

  async listHistory(userId: string): Promise<Draft[]> {
    return this.draftRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getFileUrl(
    userId: string,
    draftId: string,
  ): Promise<{ url: string | null; localFile?: boolean; fileName: string; mimeType: string }> {
    const draft = await this.draftRepo.findOne({ where: { id: draftId, userId } });
    if (!draft) throw new HttpException('Draft not found', HttpStatus.NOT_FOUND);

    if (draft.storagePath?.startsWith('supabase://')) {
      const withoutScheme = draft.storagePath.slice('supabase://'.length);
      const slashIdx = withoutScheme.indexOf('/');
      const bucket = withoutScheme.slice(0, slashIdx);
      const filePath = withoutScheme.slice(slashIdx + 1);
      const url = await this.supabaseService.getSignedUrl(bucket, filePath);
      return { url, fileName: draft.fileName, mimeType: draft.mimeType };
    }

    if (draft.storagePath?.startsWith('local://')) {
      // Signal the frontend to GET /draft-analyzer/:id/file-data (served by our own API)
      return { url: null, localFile: true, fileName: draft.fileName, mimeType: draft.mimeType };
    }

    return { url: null, fileName: draft.fileName, mimeType: draft.mimeType };
  }

  /** Serve raw file bytes from local disk — used by GET :id/file-data. */
  async getFileData(userId: string, draftId: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const draft = await this.draftRepo.findOne({ where: { id: draftId, userId } });
    if (!draft) throw new HttpException('Draft not found', HttpStatus.NOT_FOUND);

    if (!draft.storagePath?.startsWith('local://')) {
      throw new HttpException('File is not stored locally.', HttpStatus.BAD_REQUEST);
    }

    const filePath = draft.storagePath.slice('local://'.length);
    if (!fs.existsSync(filePath)) {
      throw new HttpException('Local file not found. Please re-upload the draft.', HttpStatus.NOT_FOUND);
    }

    const buffer = fs.readFileSync(filePath);
    return { buffer, mimeType: draft.mimeType };
  }

  // ─── background pipeline ───────────────────────────────────────────────────

  async analyzeInBackground(draftId: string, userId: string): Promise<void> {
    this.progressService.init(draftId);

    try {
      // Stage 1 — Extraction
      this.progressService.startPipelineStage(draftId, 'extraction', 'Extracting document text…');
      try {
        await this.extractionService.extractWithProgress(draftId, userId, patch =>
          this.progressService.update(draftId, patch),
        );
        this.progressService.finishPipelineStage(draftId, 'extraction', 'success', 'Document extracted');
      } catch (extractErr: any) {
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

      // Stages 2-5 — AI audit pipeline
      const result = await this.aiReviewer.reviewWithProgress(draftId, userId, patch =>
        this.progressService.update(draftId, patch),
      );

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

    } catch (err: any) {
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

  async delete(userId: string, draftId: string): Promise<void> {
    const draft = await this.draftRepo.findOne({ where: { id: draftId, userId } });
    if (!draft) throw new HttpException('Draft not found', HttpStatus.NOT_FOUND);

    // Clean up local file if present
    if (draft.storagePath?.startsWith('local://')) {
      try { fs.unlinkSync(draft.storagePath.slice('local://'.length)); } catch { /* already gone */ }
    }

    await this.draftRepo.remove(draft);
  }

  // ─── private helpers ───────────────────────────────────────────────────────

  private saveToLocalDisk(draftId: string, safeName: string, buffer: Buffer): string {
    const dir = path.join(LOCAL_DRAFT_DIR, draftId);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, safeName);
    fs.writeFileSync(filePath, buffer);
    return `local://${filePath}`;
  }

  private validateFile(file: { originalname: string; buffer: Buffer; size: number; mimetype: string }) {
    if (!file?.buffer || file.size <= 0) {
      throw new HttpException('Uploaded file is empty.', HttpStatus.BAD_REQUEST);
    }
    if (file.size > MAX_FILE_BYTES) {
      const mb = Math.floor(MAX_FILE_BYTES / (1024 * 1024));
      throw new HttpException(`File too large. Maximum size is ${mb} MB.`, HttpStatus.PAYLOAD_TOO_LARGE);
    }
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new HttpException('Unsupported file type. Please upload a PDF, DOCX, or TXT file.', HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new HttpException('Invalid MIME type. Only PDF, DOCX, and TXT files are accepted.', HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }
  }
}

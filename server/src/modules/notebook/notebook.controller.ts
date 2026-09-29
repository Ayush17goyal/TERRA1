import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Req,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  HttpException,
  HttpStatus,
  Body,
  Res,
  Query,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { NotebookService } from './notebook.service';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { SettingsService } from '../settings/settings.service';
import axios from 'axios';

const MAX_UPLOAD_BYTES = Number(process.env.MAX_NOTEBOOK_UPLOAD_BYTES || 25 * 1024 * 1024);
const MAX_BULK_FILES = Number(process.env.MAX_NOTEBOOK_BULK_FILES || 50);
const MAX_BULK_BYTES = Number(process.env.MAX_NOTEBOOK_BULK_BYTES || 150 * 1024 * 1024);

@Controller('notebook')
@UseGuards(ClerkAuthGuard)
export class NotebookController {
  constructor(
    private readonly notebookService: NotebookService,
    private readonly settings: SettingsService,
  ) {}

  // Fetch all documents for the user
  @Get('documents')
  async listDocuments(@Req() req: any) {
    const userId = req.user.id;
    return this.notebookService.listAll(userId);
  }

  // Fetch details of a single document
  @Get('documents/:id')
  async getDocument(@Param('id') id: string, @Req() req: any) {
    const doc = await this.notebookService.getOneForUser(id, req.user.id);
    if (!doc) {
      throw new HttpException('Document not found', HttpStatus.NOT_FOUND);
    }
    return doc;
  }

  @Get('documents/:id/preview')
  async previewDocument(@Param('id') id: string, @Req() req: any) {
    try {
      return await this.notebookService.getPreview(id, req.user.id);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }

  @Get('documents/:id/file')
  async openDocumentFile(@Param('id') id: string, @Req() req: any, @Res() res: any) {
    const userId = req.user.id;
    try {
      const { doc, path } = await this.notebookService.getStoredFile(id, userId);
      res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.name)}"`);
      return res.sendFile(path);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }

  // Fetch all parsed text chunks for a document
  @Get('documents/:id/chunks')
  async getChunks(@Param('id') id: string, @Req() req: any) {
    return this.notebookService.getChunksForUserDocument(id, req.user.id);
  }

  @Get('documents/:id/chat-history')
  async getChatHistory(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id;
    return this.notebookService.getChatHistory(userId, id);
  }

  @Post('documents/:id/reprocess')
  async reprocessDocument(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id;
    try {
      return await this.notebookService.reprocess(id, userId);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('documents/:id/extraction')
  async getExtraction(@Param('id') id: string, @Req() req: any) {
    const doc = await this.notebookService.getOneForUser(id, req.user.id);
    if (!doc) {
      throw new HttpException('Document not found', HttpStatus.NOT_FOUND);
    }
    return doc.legalMetadata || null;
  }

  @Post('documents/:id/extraction')
  async runExtraction(@Param('id') id: string, @Req() req: any) {
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
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('documents/:id/study-forge/generate')
  async generateStudyForge(@Param('id') id: string, @Req() req: any) {
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
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('documents/:id/study-forge/flashcards/:cardId/rate')
  async rateStudyForgeFlashcard(
    @Param('id') id: string,
    @Param('cardId') cardId: string,
    @Body() body: { rating: 'Hard' | 'Good' | 'Easy' },
    @Req() req: any,
  ) {
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
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('documents/:id/study-forge/quiz-attempt')
  async recordStudyForgeQuizAttempt(
    @Param('id') id: string,
    @Body() body: { answers: Record<string, number> },
    @Req() req: any,
  ) {
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
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('graph')
  async getKnowledgeGraph(@Req() req: any, @Query('documentId') documentId?: string) {
    const userId = req.user.id;
    return this.notebookService.buildKnowledgeGraph(userId, documentId);
  }

  @Get('search')
  async search(
    @Req() req: any,
    @Query('q') q: string,
    @Query('mode') mode: 'keyword' | 'vector' | 'hybrid' = 'hybrid',
    @Query('documentId') documentId?: string,
  ) {
    const userId = req.user.id;
    try {
      return await this.notebookService.searchWorkspace(userId, q, mode, documentId);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // Delete a document
  @Delete('documents/:id')
  async deleteDocument(@Param('id') id: string, @Req() req: any) {
    const deleted = await this.notebookService.delete(id, req.user.id);
    if (!deleted) {
      throw new HttpException('Document could not be deleted', HttpStatus.BAD_REQUEST);
    }
    return { success: true, message: 'Document deleted successfully' };
  }

  // Upload/Ingest new document
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async uploadDocument(
    @UploadedFile() file: any,
    @Body('documentType') documentType: string,
    @Req() req: any,
  ) {
    if (!file) {
      throw new HttpException('Multipart file payload missing', HttpStatus.BAD_REQUEST);
    }
    this.validateUploadedFile(file);

    const userId = req.user.id;
    
    // Validate format
    const name = file.originalname;
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (!this.isSupportedStudyMaterial(ext)) {
      throw new HttpException(
        'Format not supported. Please upload PDF, DOCX, PPTX, PPT, TXT, MD, CSV, JPG, JPEG, PNG, WEBP, or ZIP files.',
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }

    const doc = await this.notebookService.startIngestion(
      userId,
      {
        originalname: file.originalname,
        buffer: file.buffer,
        size: file.size,
        mimetype: file.mimetype,
      },
      documentType,
    );
    await this.settings.log({
      userId,
      module: /judg(e)?ment/i.test(name) ? 'Judgment Mastery Engine' : 'LexNotebook AI',
      action: /judg(e)?ment/i.test(name) ? 'Uploaded Judgment' : 'Uploaded Document',
      metadata: { documentId: doc.id, name, size: file.size },
    });
    return doc;
  }

  @Post('bulk-upload')
  @UseInterceptors(FilesInterceptor('files', MAX_BULK_FILES, { limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_BULK_FILES } }))
  async uploadDocuments(@UploadedFiles() files: any[], @Req() req: any) {
    if (!files?.length) {
      throw new HttpException('Multipart files payload missing', HttpStatus.BAD_REQUEST);
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

  private isSupportedStudyMaterial(ext: string) {
    return ['pdf', 'docx', 'pptx', 'ppt', 'txt', 'md', 'csv', 'jpg', 'jpeg', 'png', 'webp', 'zip'].includes(ext);
  }

  private validateUploadedFile(file: any) {
    if (!file?.buffer || file.size <= 0) {
      throw new HttpException('Uploaded file is empty.', HttpStatus.BAD_REQUEST);
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new HttpException(`File is too large. Maximum allowed size is ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`, HttpStatus.PAYLOAD_TOO_LARGE);
    }
  }

  private validateBulkUpload(files: any[]) {
    if (files.length > MAX_BULK_FILES) {
      throw new HttpException(`Too many files. Maximum allowed files per upload is ${MAX_BULK_FILES}.`, HttpStatus.PAYLOAD_TOO_LARGE);
    }
    let totalSize = 0;
    for (const file of files) {
      this.validateUploadedFile(file);
      totalSize += Number(file.size || 0);
    }
    if (totalSize > MAX_BULK_BYTES) {
      throw new HttpException(`Bulk upload is too large. Maximum allowed total size is ${Math.floor(MAX_BULK_BYTES / (1024 * 1024))} MB.`, HttpStatus.PAYLOAD_TOO_LARGE);
    }
  }

  private validateIngestUrl(rawUrl: string) {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new HttpException('Invalid URL.', HttpStatus.BAD_REQUEST);
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new HttpException('Only HTTP and HTTPS URLs are supported.', HttpStatus.BAD_REQUEST);
    }
    const host = parsed.hostname.toLowerCase();
    const blockedHost = host === 'localhost' || host.endsWith('.localhost') || host === 'metadata.google.internal';
    const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (blockedHost || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') {
      throw new HttpException('URL host is not allowed.', HttpStatus.BAD_REQUEST);
    }
    if (ipv4) {
      const a = Number(ipv4[1]);
      const b = Number(ipv4[2]);
      if (a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) {
        throw new HttpException('Private network URLs are not allowed.', HttpStatus.BAD_REQUEST);
      }
    }
  }

  // Grounded AI Chat RAG SSE Stream
  @Post('chat')
  async chatStream(
    @Body() body: { documentId: string; message: string; history: any[] },
    @Req() req: any,
    @Res() res: any,
  ) {
    if (!body.documentId || !body.message) {
      throw new HttpException('Missing documentId or message', HttpStatus.BAD_REQUEST);
    }
    
    // Set SSE Headers
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const userId = req.user.id;
    
    await this.notebookService.generateRagChatStream(
      userId,
      body.documentId,
      body.message,
      body.history || [],
      res,
    );
    await this.settings.log({
      userId,
      module: 'LexNotebook AI',
      action: 'Asked Document Question',
      metadata: { documentId: body.documentId, characters: body.message.length },
    });
  }

  @Post('url-ingest')
  async ingestFromUrl(
    @Body() body: { url: string; name?: string },
    @Req() req: any
  ) {
    if (!body.url) {
      throw new HttpException('Missing url parameter', HttpStatus.BAD_REQUEST);
    }
    this.validateIngestUrl(body.url);
    const userId = req.user.id;
    try {
      const response = await axios.get(body.url, { timeout: 12000, responseType: 'text', maxContentLength: MAX_UPLOAD_BYTES });
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
    } catch (error: any) {
      throw new HttpException(error.message || 'URL ingestion failed', HttpStatus.BAD_REQUEST);
    }
  }

  @Post('documents/:id/intelligence')
  async getDocumentIntelligence(
    @Param('id') id: string,
    @Body() body: { action: string; targetDocumentId?: string },
    @Req() req: any
  ) {
    const userId = req.user.id;
    try {
      return await this.notebookService.getDocumentIntelligence(id, body.action, userId, body.targetDocumentId);
    } catch (error: any) {
      throw new HttpException(error.message || 'Document intelligence processing failed', HttpStatus.BAD_REQUEST);
    }
  }
}


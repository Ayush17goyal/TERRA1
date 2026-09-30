import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { LearningWorkspaceService } from './learning-workspace.service';
import { SettingsService } from '../settings/settings.service';

const MAX_LEARNING_UPLOAD_BYTES = Number(process.env.MAX_LEARNING_UPLOAD_BYTES || 25 * 1024 * 1024);
const MAX_LEARNING_BULK_FILES = Number(process.env.MAX_LEARNING_BULK_FILES || 50);
const MAX_LEARNING_BULK_BYTES = Number(process.env.MAX_LEARNING_BULK_BYTES || 150 * 1024 * 1024);

@Controller('learning-workspace')
@UseGuards(ClerkAuthGuard)
export class LearningWorkspaceController {
  constructor(
    private readonly service: LearningWorkspaceService,
    private readonly settings: SettingsService,
  ) {}

  @Get()
  list(@Req() req: any) {
    return this.service.listWorkspace(this.userId(req));
  }

  @Post('sources/text')
  async createTextSource(@Req() req: any, @Body() body: any) {
    const userId = this.userId(req);
    const result = await this.service.createTextSource(userId, body);
    await this.settings.log({ userId, module: 'AI Learning & Assessment Studio', action: 'Added Learning Source', metadata: { kind: body.kind } });
    return result;
  }

  @Post('sources/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_LEARNING_UPLOAD_BYTES } }))
  async uploadSource(@Req() req: any, @UploadedFile() file: any, @Body('kind') kind: string) {
    const userId = this.userId(req);
    if (!file) {
      throw new BadRequestException('Multipart file payload missing.');
    }
    this.validateUploadedFile(file);
    const result = await this.service.uploadSource(userId, kind, file);
    await this.settings.log({ userId, module: 'AI Learning & Assessment Studio', action: 'Uploaded Learning Source', metadata: { kind, name: file?.originalname } });
    return result;
  }

  @Post('sources/bulk-upload')
  @UseInterceptors(FilesInterceptor('files', MAX_LEARNING_BULK_FILES, { limits: { fileSize: MAX_LEARNING_UPLOAD_BYTES, files: MAX_LEARNING_BULK_FILES } }))
  async uploadSources(@Req() req: any, @UploadedFiles() files: any[], @Body('kind') kind: string) {
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

  @Post('sources/:id/rename')
  async renameSource(@Req() req: any, @Param('id') id: string, @Body('newName') newName: string) {
    const userId = this.userId(req);
    const result = await this.service.renameSource(userId, id, newName);
    await this.settings.log({ userId, module: 'AI Learning & Assessment Studio', action: 'Renamed Learning Source', metadata: { id, newName } });
    return result;
  }

  @Post('sources/:id/delete')
  async deleteSource(@Req() req: any, @Param('id') id: string) {
    const userId = this.userId(req);
    const result = await this.service.deleteSource(userId, id);
    await this.settings.log({ userId, module: 'AI Learning & Assessment Studio', action: 'Deleted Learning Source', metadata: { id } });
    return result;
  }

  @Post('sources/:id/reprocess')
  async reprocessSource(@Req() req: any, @Param('id') id: string) {
    const userId = this.userId(req);
    const result = await this.service.reprocessSource(userId, id);
    await this.settings.log({ userId, module: 'AI Learning & Assessment Studio', action: 'Reprocessed Learning Source', metadata: { id } });
    return result;
  }

  @Get('mock-tests')
  async getMockTests(@Req() req: any) {
    const userId = this.userId(req);
    return this.service.getMockTests(userId);
  }

  @Get('mock-tests/attempts/:attemptId')
  async getMockTestAttempt(@Req() req: any, @Param('attemptId') attemptId: string) {
    const userId = this.userId(req);
    return this.service.getMockTestAttempt(userId, attemptId);
  }

  @Get('mock-tests/:id')
  async getMockTestById(@Req() req: any, @Param('id') id: string) {
    const userId = this.userId(req);
    return this.service.getMockTest(userId, id);
  }

  @Get('mock-tests/:id/attempts')
  async getMockTestAttempts(@Req() req: any, @Param('id') id: string) {
    const userId = this.userId(req);
    return this.service.getMockTestAttempts(userId, id);
  }

  @Post('mock-tests/generate')
  async generateMockTest(@Req() req: any, @Body() body: any) {
    const userId = this.userId(req);
    const result = await this.service.generateMockTest(userId, body);
    await this.settings.log({ userId, module: 'AI Learning & Assessment Studio', action: 'Generated Mock Test', metadata: { questionCount: result?.questions?.length || 0, mode: body.mode } });
    return result;
  }

  @Delete('mock-tests/:id')
  async deleteMockTest(@Req() req: any, @Param('id') id: string) {
    const userId = this.userId(req);
    const result = await this.service.deleteMockTest(userId, id);
    await this.settings.log({ userId, module: 'AI Learning & Assessment Studio', action: 'Deleted Mock Test', metadata: { id } });
    return result;
  }

  @Get('sources/:id/indexed-content')
  async getSourceIndexedContent(@Req() req: any, @Param('id') id: string) {
    const userId = this.userId(req);
    return this.service.getSourceIndexedContent(userId, id);
  }

  @Post('mock-tests/analyze-structure')
  async analyzeReferenceStructure(@Req() req: any, @Body() body: { sourceId: string }) {
    const userId = this.userId(req);
    return this.service.analyzeReferenceStructure(userId, body.sourceId);
  }

  @Post('mock-tests/:id/handwritten-ocr')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_LEARNING_UPLOAD_BYTES } }))
  async uploadHandwrittenAnswerSheet(@Req() req: any, @Param('id') id: string, @UploadedFile() file: any) {
    const userId = this.userId(req);
    if (!file) throw new BadRequestException('Handwritten answer sheet file is required.');
    this.validateUploadedFile(file);
    const result = await this.service.processHandwrittenAnswerSheet(userId, id, file);
    await this.settings.log({ userId, module: 'AI Learning & Assessment Studio', action: 'Uploaded Handwritten Answer Sheet', metadata: { mockTestId: id, fileName: file?.originalname } });
    return result;
  }

  @Post('mock-tests/:id/questions/:questionId/answer')
  async generateDetailedAnswer(@Req() req: any, @Param('id') id: string, @Param('questionId') questionId: string, @Body() body: any) {
    const userId = this.userId(req);
    const result = await this.service.generateDetailedAnswer(
      userId,
      id,
      questionId,
      body.mode || 'Short Answer',
      !!body.regenerate || !!body.force
    );
    await this.settings.log({
      userId,
      module: 'AI Learning & Assessment Studio',
      action: 'Generated Mock Test Answer On Demand',
      metadata: { mockTestId: id, questionId, mode: result?.mode, cached: result?.cached },
    });
    return result;
  }
  @Post('mock-tests/:id/submit')
  async submitMockTest(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const userId = this.userId(req);
    const result = await this.service.submitMockTest(userId, id, body.answers || {}, body.timeTaken || 0, body.negativeMarkingRate);
    await this.settings.log({ userId, module: 'AI Learning & Assessment Studio', action: 'Completed Quiz', metadata: { mockTestId: id, score: result?.score } });
    return result;
  }

  @Get('mock-tests/:id/export/:format')
  async exportMockTest(@Req() req: any, @Param('id') id: string, @Param('format') format: string, @Res() res: any) {
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

  @Post('mock-tests/export-compile/:format')
  async exportMockTestFromClient(@Req() req: any, @Body() body: any, @Param('format') format: string, @Res() res: any) {
    const result = await this.service.compileMockTest(body.test, format);
    res.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="MockTest.${format}"`,
      'Content-Length': result.buffer.length,
    });
    res.end(result.buffer);
  }

  @Post('mind-maps/generate')
  async generateMindMap(@Req() req: any, @Body() body: any) {
    const userId = this.userId(req);
    const result = await this.service.generateMindMap(userId, body);
    await this.settings.log({ userId, module: 'AI Learning & Assessment Studio', action: 'Generated Mind Map', metadata: { title: result?.title } });
    return result;
  }

  @Get('mind-maps/:id/export/:format')
  async exportMindMap(@Req() req: any, @Param('id') id: string, @Param('format') format: string, @Res() res: any) {
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

  @Post('study-kits/generate')
  async generateStudyKit(@Req() req: any, @Body() body: any) {
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

  @Get('study-kits/:id/export/:format')
  async exportStudyKit(@Req() req: any, @Param('id') id: string, @Param('format') format: string, @Res() res: any) {
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

  @Post('flashcards/review')
  async reviewFlashcard(@Req() req: any, @Body() body: any) {
    const userId = this.userId(req);
    const result = await this.service.reviewFlashcard(userId, body);
    await this.settings.log({ userId, module: 'AI Learning & Assessment Studio', action: 'Reviewed Flashcard', metadata: { rating: body.rating, correct: body.correct } });
    return result;
  }

  @Post('revision-plan/generate')
  async generateRevisionPlanner(@Req() req: any, @Body('durationDays') durationDays: number) {
    const userId = this.userId(req);
    const result = await this.service.generateRevisionPlanner(userId, durationDays || 7);
    await this.settings.log({ userId, module: 'AI Learning & Assessment Studio', action: 'Generated Revision Plan', metadata: { durationDays } });
    return result;
  }

  @Get('weak-areas')
  weakAreas(@Req() req: any) {
    return this.service.getWeakAreaReport(this.userId(req));
  }

  @Get('analytics')
  analytics(@Req() req: any) {
    return this.service.getAnalytics(this.userId(req));
  }

  @Post('indexing/pause')
  pauseIndexing() {
    return this.service.pauseIndexing();
  }

  @Post('indexing/resume')
  resumeIndexing() {
    return this.service.resumeIndexing();
  }

  @Get('indexing/status')
  getIndexingStatus() {
    return this.service.getIndexingStatus();
  }

  private validateUploadedFile(file: any) {
    if (!file?.buffer || Number(file.size || 0) <= 0) {
      throw new BadRequestException('Uploaded file is empty.');
    }
    if (Number(file.size || 0) > MAX_LEARNING_UPLOAD_BYTES) {
      throw new PayloadTooLargeException(`File is too large. Maximum allowed size is ${Math.floor(MAX_LEARNING_UPLOAD_BYTES / (1024 * 1024))} MB.`);
    }
  }

  private validateBulkUpload(files: any[]) {
    if (!files.length) {
      throw new BadRequestException('No files were uploaded.');
    }
    if (files.length > MAX_LEARNING_BULK_FILES) {
      throw new PayloadTooLargeException(`Too many files. Maximum allowed files per upload is ${MAX_LEARNING_BULK_FILES}.`);
    }
    let totalSize = 0;
    for (const file of files) {
      this.validateUploadedFile(file);
      totalSize += Number(file.size || 0);
    }
    if (totalSize > MAX_LEARNING_BULK_BYTES) {
      throw new PayloadTooLargeException(`Bulk upload is too large. Maximum allowed total size is ${Math.floor(MAX_LEARNING_BULK_BYTES / (1024 * 1024))} MB.`);
    }
  }

  private userId(req: any) {
    return req.user.id;
  }
}


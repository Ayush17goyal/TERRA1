import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { ResearchService } from './research.service';
import { SettingsService } from '../settings/settings.service';

@Controller('research')
@UseGuards(ClerkAuthGuard)
export class ResearchController {
  constructor(
    private readonly research: ResearchService,
    private readonly settings: SettingsService,
  ) {}

  private async userId(req: any) {
    const user = await this.research.resolveUser(req.user);
    return user.id;
  }

  @Post('query')
  async createQuery(@Req() req: any, @Body() body: { topic: string; researchMode: string }) {
    const userId = await this.userId(req);
    const result = await this.research.createQuery(userId, body);
    await this.settings.log({ userId: req.user.id, module: 'Research Command Center', action: 'Started Research Session', metadata: { topic: body.topic, researchMode: body.researchMode } });
    return result;
  }

  @Get('query/all')
  async listQueries(@Req() req: any) {
    return this.research.listQueries(await this.userId(req));
  }

  @Get('query/:id')
  async getQuery(@Req() req: any, @Param('id') id: string) {
    return this.research.getQuery(await this.userId(req), id);
  }

  @Post('report')
  async createReport(@Req() req: any, @Body() body: any) {
    const userId = await this.userId(req);
    const result = await this.research.createReport(userId, body);
    await this.settings.log({ userId: req.user.id, module: 'Research Command Center', action: 'Generated Research Report', metadata: { reportId: result.id, title: result.title } });
    return result;
  }

  @Get('report/:id')
  async getReport(@Req() req: any, @Param('id') id: string) {
    return this.research.getReport(await this.userId(req), id);
  }

  @Put('report/:id')
  async updateReport(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.research.updateReport(await this.userId(req), id, body);
  }

  @Delete('report/:id')
  async deleteReport(@Req() req: any, @Param('id') id: string) {
    return this.research.deleteReport(await this.userId(req), id);
  }

  @Post('note')
  async createNote(@Req() req: any, @Body() body: { reportId: string; title: string; content: string }) {
    const userId = await this.userId(req);
    const result = await this.research.createNote(userId, body);
    await this.settings.log({ userId: req.user.id, module: 'Research Command Center', action: 'Created Research Note', metadata: { reportId: body.reportId, title: body.title } });
    return result;
  }

  @Get('note/:id')
  async getNote(@Req() req: any, @Param('id') id: string) {
    return this.research.getNote(await this.userId(req), id);
  }

  @Put('note/:id')
  async updateNote(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.research.updateNote(await this.userId(req), id, body);
  }

  @Delete('note/:id')
  async deleteNote(@Req() req: any, @Param('id') id: string) {
    return this.research.deleteNote(await this.userId(req), id);
  }

  @Post('source')
  async createSource(@Req() req: any, @Body() body: any) {
    const userId = await this.userId(req);
    const result = await this.research.createSource(userId, body);
    await this.settings.log({ userId: req.user.id, module: 'Research Command Center', action: body.sourceType === 'case' ? 'Retrieved Case' : 'Added Source', metadata: { reportId: body.reportId, sourceType: body.sourceType, title: body.title } });
    return result;
  }

  @Get('source/:id')
  async getSource(@Req() req: any, @Param('id') id: string) {
    return this.research.getSource(await this.userId(req), id);
  }

  @Delete('source/:id')
  async deleteSource(@Req() req: any, @Param('id') id: string) {
    return this.research.deleteSource(await this.userId(req), id);
  }

  @Post('save')
  async saveReport(@Req() req: any, @Body() body: { reportId: string }) {
    return this.research.saveReport(await this.userId(req), body.reportId);
  }

  @Get('save/all')
  async listSavedReports(@Req() req: any) {
    return this.research.listSavedReports(await this.userId(req));
  }

  @Delete('save/:id')
  async deleteSavedReport(@Req() req: any, @Param('id') id: string) {
    return this.research.deleteSavedReport(await this.userId(req), id);
  }

  @Post('asset')
  async createAsset(@Req() req: any, @Body() body: any) {
    return this.research.createAsset(await this.userId(req), body);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Req() req: any,
    @UploadedFile() file: any,
    @Body() body: { queryId?: string; docCategory: string },
  ) {
    const userId = await this.userId(req);

    // Browser/local-storage sessions can contain a queryId from an older database.
    // Validate it before inserting research_documents so SQLite/Postgres FK checks do not fail.
    let validQueryId = body.queryId?.trim() || undefined;
    if (validQueryId) {
      try {
        await this.research.getQuery(userId, validQueryId);
      } catch {
        validQueryId = undefined;
      }
    }

    const result = await this.research.uploadDocument(userId, file, validQueryId, body.docCategory);
    await this.settings.log({
      userId: req.user.id,
      module: 'Research Command Center',
      action: 'Uploaded Research Document',
      metadata: {
        queryId: validQueryId || null,
        docCategory: body.docCategory,
        name: file?.originalname,
      },
    });
    return result;
  }

  @Get('documents/:queryId')
  async getDocuments(@Req() req: any, @Param('queryId') queryId: string) {
    const userId = await this.userId(req);
    return this.research.getDocuments(userId, queryId);
  }

  @Post('generate')
  async generateResearch(
    @Req() req: any,
    @Body() body: {
      queryId?: string;
      topic: string;
      researchMode: string;
      sources: string[];
      provider?: string;
      depth?: 'standard' | 'deep' | 'exhaustive';
      selectedWorkspace?: string;
      detectedType?: string;
      pipeline?: string;
    },
  ) {
    const userId = await this.userId(req);
    const result = await this.research.generateReport(userId, body);
    await this.settings.log({
      userId: req.user.id,
      module: 'Research Command Center',
      action: 'Generated Research Report',
      metadata: {
        reportId: result?.id,
        topic: body.topic,
        researchMode: body.researchMode,
        sources: body.sources?.length || 0,
      },
    });
    return result;
  }

  @Post('judgment-intelligence')
  async generateJudgmentIntelligence(
    @Req() req: any,
    @Body() body: {
      queryId?: string;
      topic: string;
      researchMode: string;
      sources: string[];
      provider?: string;
      depth?: 'standard' | 'deep' | 'exhaustive';
    },
  ) {
    const userId = await this.userId(req);
    const result = await this.research.generateJudgmentIntelligence(userId, body);
    await this.settings.log({
      userId: req.user.id,
      module: 'Judgment Intelligence Engine',
      action: 'Generated Judgment Intelligence Report',
      metadata: { reportId: result?.id, topic: body.topic, sources: body.sources?.length || 0 },
    });
    return result;
  }

  @Post('legal-brief')
  async generateLegalBrief(
    @Req() req: any,
    @Body() body: {
      queryId?: string;
      topic: string;
      researchMode: string;
      sources: string[];
      provider?: string;
      depth?: 'standard' | 'deep' | 'exhaustive';
    },
  ) {
    const userId = await this.userId(req);
    const result = await this.research.generateLegalBrief(userId, body);
    await this.settings.log({
      userId: req.user.id,
      module: 'Legal Research Command Center',
      action: 'Generated Legal Brief',
      metadata: { reportId: result?.id, topic: body.topic, template: 'Model Case Brief' },
    });
    return result;
  }

  @Post('bare-act')
  async generateBareActAnalysis(
    @Req() req: any,
    @Body() body: {
      queryId?: string;
      topic: string;
      researchMode: string;
      sources: string[];
      provider?: string;
      depth?: 'standard' | 'deep' | 'exhaustive';
    },
  ) {
    const userId = await this.userId(req);
    const result = await this.research.generateBareActAnalysis(userId, body);
    await this.settings.log({
      userId: req.user.id,
      module: 'Legal Research Command Center',
      action: 'Generated Bare Act Analysis',
      metadata: { reportId: result?.id, topic: body.topic, template: 'Bare Act Statutory Analysis' },
    });
    return result;
  }

  @Get('judgment-intelligence')
  async listJudgmentReports(@Req() req: any, @Query('search') search?: string) {
    return this.research.listJudgmentReports(await this.userId(req), search);
  }

  @Get('judgment-intelligence/analytics')
  async judgmentAnalytics(@Req() req: any) {
    return this.research.getJudgmentAnalytics(await this.userId(req));
  }

  @Get('judgment-intelligence/:id')
  async getJudgmentReport(@Req() req: any, @Param('id') id: string) {
    return this.research.getJudgmentReport(await this.userId(req), id);
  }

  @Delete('judgment-intelligence/:id')
  async deleteJudgmentReport(@Req() req: any, @Param('id') id: string) {
    return this.research.deleteJudgmentReport(await this.userId(req), id);
  }

  @Post('challenge')
  async challengeResearch(@Req() req: any, @Body() body: { reportId: string }) {
    const userId = await this.userId(req);
    const result = await this.research.challengeReport(userId, body.reportId);
    await this.settings.log({ userId: req.user.id, module: 'Research Command Center', action: 'Challenged Research Report', metadata: { reportId: body.reportId } });
    return result;
  }
}

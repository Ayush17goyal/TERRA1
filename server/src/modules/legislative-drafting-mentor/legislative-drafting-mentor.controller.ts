import { Body, Controller, Get, Logger, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { DraftingWorkflowEngineService } from './drafting-workflow-engine.service';
import { AcademyProfessorService } from './academy-professor.service';
import { ACADEMY_CURRICULUM } from './academy-curriculum';

@Controller('drafting-mentor')
@UseGuards(ClerkAuthGuard)
export class LegislativeDraftingMentorController {
  private readonly logger = new Logger(LegislativeDraftingMentorController.name);
  constructor(
    private readonly workflowEngine: DraftingWorkflowEngineService,
    private readonly professor: AcademyProfessorService,
  ) {}

  @Get('academy/curriculum')
  getAcademyCurriculum() { return ACADEMY_CURRICULUM; }

  @Get('academy/lessons/:index')
  getAcademyLesson(@Req() req: any, @Param('index') index: string) { return this.professor.lesson(req.user.id, Number(index)); }

  @Post('academy/lessons/:index/review')
  async reviewAcademyDraft(@Req() req: any, @Param('index') index: string, @Body('answer') answer: string) {
    const started = Date.now();
    this.logger.log('Review controller request user=' + req.user.id + '; lesson=' + index + '; answerLength=' + String(answer || '').length);
    try {
      const result = await this.professor.review(req.user.id, Number(index), answer);
      this.logger.log('Review controller response user=' + req.user.id + '; lesson=' + index + '; status=200; verdict=' + result.status + '; score=' + result.overallScore + '; durationMs=' + (Date.now() - started));
      return result;
    } catch (error: any) {
      this.logger.error('Review controller error user=' + req.user.id + '; lesson=' + index + '; status=' + (error?.status || 500) + '; durationMs=' + (Date.now() - started) + '; error=' + (error?.message || String(error)));
      throw error;
    }
  }

  @Post('academy/lessons/:index/mastery')
  async gradeAcademyMastery(@Req() req: any, @Param('index') index: string, @Body('answer') answer: string) {
    return this.professor.mastery(req.user.id, Number(index), answer);
  }

  @Post('academy/lessons/:index/practice')
  async generatePractice(@Req() req: any, @Param('index') index: string, @Body('prompt') prompt: string, @Body('difficulty') difficulty?: string) {
    return this.professor.generatePractice(req.user.id, Number(index), prompt, difficulty);
  }
  @Get('academy/state')
  getAcademyState(@Req() req: any) {
    return this.workflowEngine.getAcademyState(req.user.id);
  }

  @Put('academy/state')
  syncAcademyState(@Req() req: any, @Body() body: any) {
    return this.workflowEngine.syncAcademyState(req.user.id, body);
  }

  @Get('lessons')
  getLessonCatalog() {
    return this.workflowEngine.getLessonCatalog();
  }

  @Post('sessions')
  createSession(@Req() req: any, @Body('topic') topic: string) {
    return this.workflowEngine.createSession(req.user.id, topic);
  }

  @Get('sessions')
  listSessions(@Req() req: any) {
    return this.workflowEngine.listSessions(req.user.id);
  }

  @Get('sessions/:id')
  resumeSession(@Req() req: any, @Param('id') id: string) {
    return this.workflowEngine.resumeSession(req.user.id, id);
  }

  @Post('sessions/:id/advance')
  advance(@Req() req: any, @Param('id') id: string) {
    return this.workflowEngine.advance(req.user.id, id);
  }

  @Post('sessions/:id/back')
  goBack(@Req() req: any, @Param('id') id: string) {
    return this.workflowEngine.goBack(req.user.id, id);
  }

  @Post('sessions/:id/goto')
  goToLesson(@Req() req: any, @Param('id') id: string, @Body('lessonIndex') lessonIndex: number) {
    return this.workflowEngine.goToLesson(req.user.id, id, Number(lessonIndex));
  }
}

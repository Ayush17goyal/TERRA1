import { Controller, Post, Get, Param, Body, UseGuards, Req } from '@nestjs/common';
import { JudgmentService } from './judgment.service';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';

@Controller('judgments')
@UseGuards(ClerkAuthGuard)
export class JudgmentController {
  constructor(private readonly judgmentService: JudgmentService) {}

  @Post(':documentId/analyze')
  async analyzeJudgment(@Param('documentId') documentId: string, @Req() req: any) {
    return this.judgmentService.analyzeJudgment(documentId, req.user.id);
  }

  @Get(':documentId/analysis')
  async getAnalysis(@Param('documentId') documentId: string, @Req() req: any) {
    return this.judgmentService.getAnalysis(documentId, req.user.id);
  }

  @Post(':documentId/explain')
  async explainMode(@Param('documentId') documentId: string, @Body() body: { mode: string }, @Req() req: any) {
    return this.judgmentService.explainLike(documentId, body.mode, req.user.id);
  }

  @Post(':documentId/evaluate-verdict')
  async evaluateVerdict(@Param('documentId') documentId: string, @Body() body: { userVerdict: string }, @Req() req: any) {
    return this.judgmentService.evaluateVerdict(documentId, body.userVerdict, req.user.id);
  }

  @Post(':documentId/revision-notes')
  async generateRevisionNotes(@Param('documentId') documentId: string, @Req() req: any) {
    return this.judgmentService.generateRevisionNotes(documentId, req.user.id);
  }

  @Post(':documentId/moot-court-kit')
  async generateMootCourtKit(@Param('documentId') documentId: string, @Req() req: any) {
    return this.judgmentService.generateMootCourtKit(documentId, req.user.id);
  }

  @Post(':documentId/alternative-reasoning')
  async generateAlternativeReasoning(@Param('documentId') documentId: string, @Req() req: any) {
    return this.judgmentService.generateAlternativeReasoning(documentId, req.user.id);
  }

  @Post(':documentId/mastery')
  async getJudgmentMastery(
    @Param('documentId') documentId: string,
    @Body() body: { action: string },
    @Req() req: any
  ) {
    return this.judgmentService.getJudgmentMastery(documentId, body.action, req.user.id);
  }
}



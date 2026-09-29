import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { AnswerEvaluationRequest } from './answer-evaluation.types';
import { AnswerEvaluationService } from './answer-evaluation.service';

@Controller('exam-engine/answer-evaluation')
@UseGuards(ClerkAuthGuard)
export class AnswerEvaluationController {
  constructor(private readonly answerEvaluation: AnswerEvaluationService) {}

  @Post('evaluate')
  async evaluate(@Body() body: AnswerEvaluationRequest, @Req() req: any) {
    return this.answerEvaluation.evaluate(req.user.id, body);
  }

  @Get('history')
  async history(@Req() req: any) {
    return this.answerEvaluation.listHistory(req.user.id);
  }

  @Get('questions/:questionId/history')
  async questionHistory(@Param('questionId') questionId: string, @Req() req: any) {
    return this.answerEvaluation.listQuestionHistory(req.user.id, questionId);
  }

  @Get('history/:id')
  async getAttempt(@Param('id') id: string, @Req() req: any) {
    return this.answerEvaluation.getAttempt(req.user.id, id);
  }
}

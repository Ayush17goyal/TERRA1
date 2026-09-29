import { Body, Controller, Get, Header, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { MockTestGenerationRequest } from './mock-test-engine.types';
import { MockTestEngineService } from './mock-test-engine.service';

@Controller('exam-engine/mock-tests')
@UseGuards(ClerkAuthGuard)
export class MockTestEngineController {
  constructor(private readonly mockTests: MockTestEngineService) {}

  @Post('generate')
  async generate(@Body() body: MockTestGenerationRequest, @Req() req: any) {
    return this.mockTests.generatePaper(req.user.id, body || { prompt: '' });
  }

  @Get()
  async list(@Req() req: any) {
    return this.mockTests.listPapers(req.user.id);
  }

  @Get(':id')
  async get(@Param('id') id: string, @Req() req: any) {
    const paper = await this.mockTests.getPaper(req.user.id, id);
    const questions = await this.mockTests.getPaperQuestions(req.user.id, id);
    return { ...paper, questions, pdfBase64: undefined };
  }

  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  async pdf(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    const pdf = await this.mockTests.getPaperPdf(req.user.id, id);
    res.setHeader('Content-Disposition', `inline; filename="mock-test-${id}.pdf"`);
    res.send(pdf);
  }

  /** GET cached model answer for a question bank entry */
  @Get('questions/:questionId/model-answer')
  async getModelAnswer(@Param('questionId') questionId: string, @Req() req: any) {
    return this.mockTests.getModelAnswer(req.user.id, questionId);
  }

  /** POST generate (or regenerate) model answer — stores result in question bank */
  @Post('questions/:questionId/model-answer')
  async generateModelAnswer(
    @Param('questionId') questionId: string,
    @Body() body: { question: string; topic: string; markValue: number; force?: boolean },
    @Req() req: any,
  ) {
    return this.mockTests.generateModelAnswer(
      req.user.id,
      questionId,
      body.question || '',
      body.topic || '',
      Number(body.markValue) || 15,
      body.force === true,
    );
  }
}

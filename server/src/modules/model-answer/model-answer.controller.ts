import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { ModelAnswerService } from './model-answer.service';

@Controller('exam-engine/model-answers')
@UseGuards(ClerkAuthGuard)
export class ModelAnswerController {
  constructor(private readonly modelAnswers: ModelAnswerService) {}

  @Post('create')
  async create(@Req() req: any) {
    return this.modelAnswers.createAnswerBank(req.user.id);
  }

  @Get()
  async list(@Req() req: any) {
    return this.modelAnswers.listForUser(req.user.id);
  }

  @Get(':id')
  async get(@Param('id') id: string, @Req() req: any) {
    return this.modelAnswers.getAnswer(req.user.id, id);
  }
}

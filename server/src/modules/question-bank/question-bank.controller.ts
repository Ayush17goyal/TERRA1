import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { QuestionBankService } from './question-bank.service';

@Controller('exam-engine/question-bank')
@UseGuards(ClerkAuthGuard)
export class QuestionBankController {
  constructor(private readonly questionBank: QuestionBankService) {}

  @Post('create')
  async create(@Req() req: any) {
    return this.questionBank.createQuestionBank(req.user.id);
  }

  @Get()
  async list(@Req() req: any) {
    return this.questionBank.listForUser(req.user.id);
  }

  @Get(':id')
  async get(@Param('id') id: string, @Req() req: any) {
    return this.questionBank.getEntry(req.user.id, id);
  }
}

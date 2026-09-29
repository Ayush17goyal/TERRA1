import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { QuestionPlanningService } from './question-planning.service';

@Controller('exam-engine/question-planning')
@UseGuards(ClerkAuthGuard)
export class QuestionPlanningController {
  constructor(private readonly planning: QuestionPlanningService) {}

  @Post('build')
  async build(@Req() req: any) {
    return this.planning.buildPlan(req.user.id);
  }

  @Get('plan')
  async plan(@Req() req: any) {
    return this.planning.getPlan(req.user.id);
  }

  @Get('slots')
  async slots(@Req() req: any) {
    return this.planning.getSlots(req.user.id);
  }

  @Get('coverage-matrix')
  async coverageMatrix(@Req() req: any) {
    return this.planning.getCoverageMatrix(req.user.id);
  }
}

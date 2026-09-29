import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { LearningIntelligenceService } from './learning-intelligence.service';

@Controller('exam-engine/learning-intelligence')
@UseGuards(ClerkAuthGuard)
export class LearningIntelligenceController {
  constructor(private readonly learningIntelligence: LearningIntelligenceService) {}

  @Get('recommendations')
  async recommendations(@Req() req: any) {
    return this.learningIntelligence.getReport(req.user.id);
  }

  @Get('revision-plan')
  async revisionPlan(@Req() req: any) {
    return this.learningIntelligence.getRevisionPlan(req.user.id);
  }

  @Get('practice-questions')
  async practiceQuestions(@Req() req: any) {
    return this.learningIntelligence.getPracticeQuestions(req.user.id);
  }

  @Get('mock-tests')
  async mockTests(@Req() req: any) {
    return this.learningIntelligence.getMockTestRecommendations(req.user.id);
  }
}

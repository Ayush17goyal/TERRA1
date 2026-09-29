import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { AnalyticsEngineService } from './analytics-engine.service';

@Controller('exam-engine/analytics')
@UseGuards(ClerkAuthGuard)
export class AnalyticsEngineController {
  constructor(private readonly analytics: AnalyticsEngineService) {}

  @Get('dashboard')
  async dashboard(@Req() req: any) {
    return this.analytics.getDashboard(req.user.id);
  }

  @Get('topics')
  async topics(@Req() req: any) {
    return this.analytics.getTopicPerformance(req.user.id);
  }

  @Get('weak-topics')
  async weakTopics(@Req() req: any) {
    return this.analytics.getWeakTopics(req.user.id);
  }

  @Get('strong-topics')
  async strongTopics(@Req() req: any) {
    return this.analytics.getStrongTopics(req.user.id);
  }

  @Get('progress')
  async progress(@Req() req: any) {
    return this.analytics.getProgress(req.user.id);
  }
}

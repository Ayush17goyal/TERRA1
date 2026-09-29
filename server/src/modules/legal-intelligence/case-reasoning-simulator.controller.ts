import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { CaseReasoningSimulatorService } from './case-reasoning-simulator.service';

type AuthenticatedRequest = {
  user: { id: string };
};

type AnalyzeBody = {
  caseNameOrProblem?: string;
  studentReasoning?: string;
  studentSolution?: string;
};

@Controller('legal-intelligence/case-reasoning-simulator')
@UseGuards(ClerkAuthGuard)
export class CaseReasoningSimulatorController {
  constructor(private readonly simulator: CaseReasoningSimulatorService) {}

  @Post('analyze')
  analyze(@Req() req: AuthenticatedRequest, @Body() body: AnalyzeBody) {
    return this.simulator.analyze(req.user.id, body);
  }

  @Get('history')
  history(@Req() req: AuthenticatedRequest) {
    return this.simulator.listHistory(req.user.id);
  }

  @Get('history/:id')
  getAttempt(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.simulator.getAttempt(req.user.id, id);
  }

  @Patch('history/:id/save')
  saveAttempt(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.simulator.saveAttempt(req.user.id, id);
  }
}

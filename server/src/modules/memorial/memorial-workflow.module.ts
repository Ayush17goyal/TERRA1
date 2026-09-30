import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { MemorialWorkflowController } from './memorial-workflow.controller';
import { MemorialWorkflowService } from './memorial-workflow.service';
import { MemorialAiService } from './memorial-ai.service';
import { PropositionPreservationService } from './proposition-preservation.service';
import { PropositionIntelligenceService } from './proposition-intelligence.service';
import { CaseGraphService } from './case-graph.service';
import { IssueEngineService } from './issue-engine.service';
import { AuthorityEngineService } from './authority-engine.service';
import { ArgumentEngineService } from './argument-engine.service';
import { MemorialCompilerService } from './memorial-compiler.service';
import { MemorialJudgeService } from './memorial-judge.service';

@Module({
  imports: [ChatModule, RetrievalModule],
  controllers: [MemorialWorkflowController],
  providers: [
    MemorialWorkflowService,
    MemorialAiService,
    PropositionPreservationService,
    PropositionIntelligenceService,
    CaseGraphService,
    IssueEngineService,
    AuthorityEngineService,
    ArgumentEngineService,
    MemorialCompilerService,
    MemorialJudgeService,
  ],
  exports: [MemorialWorkflowService],
})
export class MemorialWorkflowModule {}

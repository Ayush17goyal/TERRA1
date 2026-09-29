import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatModule } from '../chat/chat.module';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { CaseReasoningSimulatorController } from './case-reasoning-simulator.controller';
import { CaseReasoningSimulatorService } from './case-reasoning-simulator.service';
import { LegalIntelligenceController } from './legal-intelligence.controller';
import {
  DraftingAcademyCheck,
  DraftingAcademyCourse,
  LegalAuthorityVerification,
  LegalResearchGuideSession,
  CaseSimulationSession,
  ResearchMentorSession,
} from './legal-intelligence.entities';
import { LegalIntelligenceService } from './legal-intelligence.service';

import { ParsedProvisionEntity } from '../ingestion/entities/parsed-provision.entity';

@Module({
  imports: [
    RetrievalModule,
    TypeOrmModule.forFeature([
      LegalAuthorityVerification,
      LegalResearchGuideSession,
      DraftingAcademyCourse,
      DraftingAcademyCheck,
      CaseSimulationSession,
      ResearchMentorSession,
      ParsedProvisionEntity,
    ]),
    ChatModule,
  ],
  controllers: [LegalIntelligenceController, CaseReasoningSimulatorController],
  providers: [LegalIntelligenceService, CaseReasoningSimulatorService],
  exports: [LegalIntelligenceService],
})
export class LegalIntelligenceModule {}



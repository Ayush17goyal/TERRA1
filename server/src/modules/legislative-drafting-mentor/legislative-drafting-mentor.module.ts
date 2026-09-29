import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DraftingSession } from './entities/drafting-session.entity';
import { DraftingWorkflowEngineService } from './drafting-workflow-engine.service';
import { LegislativeDraftingMentorController } from './legislative-drafting-mentor.controller';
import { AcademyProfessorService } from './academy-professor.service';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [TypeOrmModule.forFeature([DraftingSession]), ChatModule],
  controllers: [LegislativeDraftingMentorController],
  providers: [DraftingWorkflowEngineService, AcademyProfessorService],
  exports: [DraftingWorkflowEngineService],
})
export class LegislativeDraftingMentorModule {}

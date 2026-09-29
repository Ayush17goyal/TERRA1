import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ResearchAsset,
  ResearchNote,
  ResearchQuery,
  ResearchReport,
  ResearchSource,
  ResearchUser,
  SavedReport,
  ResearchDocument,
  JudgmentReport,
} from './research.entities';
import { ResearchController } from './research.controller';
import { ResearchService } from './research.service';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { ExamModule } from '../exam/exam.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ResearchUser,
      ResearchQuery,
      ResearchReport,
      ResearchSource,
      ResearchNote,
      SavedReport,
      ResearchAsset,
      ResearchDocument,
      JudgmentReport,
    ]),
    RetrievalModule,
    ExamModule,
    ChatModule,
  ],
  controllers: [ResearchController],
  providers: [ResearchService],
  exports: [ResearchService],
})
export class ResearchModule {}

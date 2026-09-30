import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LearningWorkspaceController } from './learning-workspace.controller';
import {
  AiFlashcardReview,
  AiLearningActivity,
  AiLearningSource,
  AiMindMap,
  AiMockTest,
  AiMockTestAttempt,
  AiStudyKit,
  AiQuestionVaultItem,
} from './learning-workspace.entities';
import { LearningWorkspaceService } from './learning-workspace.service';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { ExamModule } from '../exam/exam.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiFlashcardReview,
      AiLearningActivity,
      AiLearningSource,
      AiMindMap,
      AiMockTest,
      AiMockTestAttempt,
      AiStudyKit,
      AiQuestionVaultItem,
    ]),
    RetrievalModule,
    ExamModule,
  ],
  controllers: [LearningWorkspaceController],
  providers: [LearningWorkspaceService],
})
export class LearningWorkspaceModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsEngineModule } from '../analytics-engine/analytics-engine.module';
import { AnswerEvaluationAttemptEntity } from '../answer-evaluation/entities/answer-evaluation-attempt.entity';
import { MockTestPaperEntity } from '../mock-test-engine/entities/mock-test-paper.entity';
import { QuestionBankEntryEntity } from '../question-bank/entities/question-bank-entry.entity';
import { LearningIntelligenceController } from './learning-intelligence.controller';
import { LearningIntelligenceService } from './learning-intelligence.service';

@Module({
  imports: [
    AnalyticsEngineModule,
    TypeOrmModule.forFeature([AnswerEvaluationAttemptEntity, QuestionBankEntryEntity, MockTestPaperEntity]),
  ],
  controllers: [LearningIntelligenceController],
  providers: [LearningIntelligenceService],
  exports: [LearningIntelligenceService],
})
export class LearningIntelligenceModule {}

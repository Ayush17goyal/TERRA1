import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnswerEvaluationAttemptEntity } from '../answer-evaluation/entities/answer-evaluation-attempt.entity';
import { QuestionBankEntryEntity } from '../question-bank/entities/question-bank-entry.entity';
import { AnalyticsEngineController } from './analytics-engine.controller';
import { AnalyticsEngineService } from './analytics-engine.service';

@Module({
  imports: [TypeOrmModule.forFeature([AnswerEvaluationAttemptEntity, QuestionBankEntryEntity])],
  controllers: [AnalyticsEngineController],
  providers: [AnalyticsEngineService],
  exports: [AnalyticsEngineService],
})
export class AnalyticsEngineModule {}

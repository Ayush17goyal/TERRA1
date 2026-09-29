import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelAnswerEntryEntity } from '../model-answer/entities/model-answer-entry.entity';
import { QuestionBankEntryEntity } from '../question-bank/entities/question-bank-entry.entity';
import { AnswerEvaluationController } from './answer-evaluation.controller';
import { AnswerEvaluationService } from './answer-evaluation.service';
import { AnswerEvaluationAttemptEntity } from './entities/answer-evaluation-attempt.entity';

@Module({
  imports: [TypeOrmModule.forFeature([QuestionBankEntryEntity, ModelAnswerEntryEntity, AnswerEvaluationAttemptEntity])],
  controllers: [AnswerEvaluationController],
  providers: [AnswerEvaluationService],
  exports: [AnswerEvaluationService],
})
export class AnswerEvaluationModule {}

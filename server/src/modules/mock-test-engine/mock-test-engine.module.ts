import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionBankEntryEntity } from '../question-bank/entities/question-bank-entry.entity';
import { QuestionPlanEntity } from '../question-planning/entities/question-plan.entity';
import { MockTestPaperEntity } from './entities/mock-test-paper.entity';
import { MockTestPaperQuestionEntity } from './entities/mock-test-paper-question.entity';
import { MockTestEngineController } from './mock-test-engine.controller';
import { MockTestEngineService } from './mock-test-engine.service';
import { RetrievalModule } from '../retrieval/retrieval.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([QuestionBankEntryEntity, QuestionPlanEntity, MockTestPaperEntity, MockTestPaperQuestionEntity]),
    RetrievalModule,
  ],
  controllers: [MockTestEngineController],
  providers: [MockTestEngineService],
  exports: [MockTestEngineService],
})
export class MockTestEngineModule {}

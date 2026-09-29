import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TopicKnowledgeUnitEntity } from '../knowledge-engine/entities/topic-knowledge-unit.entity';
import { QuestionPlanEntity } from '../question-planning/entities/question-plan.entity';
import { QuestionSlotEntity } from '../question-planning/entities/question-slot.entity';
import { ModelAnswerModule } from '../model-answer/model-answer.module';
import { QuestionBankEntryEntity } from './entities/question-bank-entry.entity';
import { QuestionBankController } from './question-bank.controller';
import { QuestionBankService } from './question-bank.service';
import { QuestionBankQueueService } from './question-bank-queue.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([QuestionPlanEntity, QuestionSlotEntity, TopicKnowledgeUnitEntity, QuestionBankEntryEntity]),
    ModelAnswerModule,
  ],
  controllers: [QuestionBankController],
  providers: [QuestionBankService, QuestionBankQueueService],
  exports: [QuestionBankService, QuestionBankQueueService],
})
export class QuestionBankModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TopicKnowledgeUnitEntity } from '../knowledge-engine/entities/topic-knowledge-unit.entity';
import { QuestionBankModule } from '../question-bank/question-bank.module';
import { QuestionPlanEntity } from './entities/question-plan.entity';
import { QuestionSlotEntity } from './entities/question-slot.entity';
import { QuestionPlanningController } from './question-planning.controller';
import { QuestionPlanningService } from './question-planning.service';
import { QuestionPlanningQueueService } from './question-planning-queue.service';

@Module({
  imports: [TypeOrmModule.forFeature([TopicKnowledgeUnitEntity, QuestionPlanEntity, QuestionSlotEntity]), QuestionBankModule],
  controllers: [QuestionPlanningController],
  providers: [QuestionPlanningService, QuestionPlanningQueueService],
  exports: [QuestionPlanningService, QuestionPlanningQueueService],
})
export class QuestionPlanningModule {}

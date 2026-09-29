import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TopicKnowledgeUnitEntity } from '../knowledge-engine/entities/topic-knowledge-unit.entity';
import { QuestionBankEntryEntity } from '../question-bank/entities/question-bank-entry.entity';
import { ChatModule } from '../chat/chat.module';
import { ModelAnswerEntryEntity } from './entities/model-answer-entry.entity';
import { ModelAnswerController } from './model-answer.controller';
import { ModelAnswerService } from './model-answer.service';
import { ModelAnswerQueueService } from './model-answer-queue.service';

@Module({
  imports: [TypeOrmModule.forFeature([QuestionBankEntryEntity, TopicKnowledgeUnitEntity, ModelAnswerEntryEntity]), ChatModule],
  controllers: [ModelAnswerController],
  providers: [ModelAnswerService, ModelAnswerQueueService],
  exports: [ModelAnswerService, ModelAnswerQueueService],
})
export class ModelAnswerModule {}

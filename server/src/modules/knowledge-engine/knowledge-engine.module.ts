import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentKnowledgeRecordEntity } from '../document-engine/entities/document-knowledge-record.entity';
import { IngestedDocumentEntity } from '../document-engine/entities/ingested-document.entity';
import { QuestionPlanningModule } from '../question-planning/question-planning.module';
import { KnowledgeEngineController } from './knowledge-engine.controller';
import { KnowledgeEngineQueueService } from './knowledge-engine-queue.service';
import { KnowledgeEngineService } from './knowledge-engine.service';
import { PersonalExamLibraryEntity } from './entities/personal-exam-library.entity';
import { TopicGraphEdgeEntity } from './entities/topic-graph-edge.entity';
import { TopicKnowledgeUnitEntity } from './entities/topic-knowledge-unit.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IngestedDocumentEntity,
      DocumentKnowledgeRecordEntity,
      PersonalExamLibraryEntity,
      TopicKnowledgeUnitEntity,
      TopicGraphEdgeEntity,
    ]),
    QuestionPlanningModule,
  ],
  controllers: [KnowledgeEngineController],
  providers: [KnowledgeEngineService, KnowledgeEngineQueueService],
  exports: [KnowledgeEngineService, KnowledgeEngineQueueService],
})
export class KnowledgeEngineModule {}

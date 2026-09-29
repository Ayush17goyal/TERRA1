import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { ChatModule } from '../chat/chat.module';
import { IngestionService } from './ingestion.service';
import { IngestionController } from './ingestion.controller';
import { CorpusScannerService } from './corpus-scanner.service';
import { LegalActEntity } from './entities/legal-act.entity';
import { ParsedProvisionEntity } from './entities/parsed-provision.entity';

/**
 * Ingestion Module
 * =================
 * Provides the BGE-M3 document ingestion pipeline.
 * Imports RetrievalModule for Qdrant and Embedding access.
 */
@Module({
  imports: [
    RetrievalModule,
    ChatModule,
    TypeOrmModule.forFeature([LegalActEntity, ParsedProvisionEntity]),
  ],
  controllers: [IngestionController],
  providers: [IngestionService, CorpusScannerService],
  exports: [IngestionService, CorpusScannerService],
})
export class IngestionModule {}

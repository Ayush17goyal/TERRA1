import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QdrantService } from './qdrant.service';
import { EmbeddingService } from './embedding.service';
import { VectorSearchService } from './vector-search.service';
import { BgeM3Provider } from './bge-m3.provider';
import { LegalRetrievalService } from './legal-retrieval.service';
import { RetrievalController } from './retrieval.controller';
import { ParsedProvisionEntity } from '../ingestion/entities/parsed-provision.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ParsedProvisionEntity]),
  ],
  controllers: [RetrievalController],
  providers: [
    QdrantService,
    EmbeddingService,
    VectorSearchService,
    BgeM3Provider,
    LegalRetrievalService,
  ],
  exports: [
    QdrantService,
    EmbeddingService,
    VectorSearchService,
    BgeM3Provider,
    LegalRetrievalService,
  ],
})
export class RetrievalModule {}

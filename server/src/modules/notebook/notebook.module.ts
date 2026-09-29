import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotebookController } from './notebook.controller';
import { NotebookService } from './notebook.service';
import { NotebookDocument } from './notebook.entity';
import { DocumentChunk } from './chunk.entity';
import { NotebookChatMessage } from './chat-message.entity';
import { NotebookSearchHistory } from './search-history.entity';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { LegalDomainModule } from '../legal-domain/legal-domain.module';
import { ChatModule } from '../chat/chat.module';
import { DocumentProcessor } from '../../services/document-processor';
import { VectorStoreService } from '../../services/vector-store';
import { DocumentUploadServiceNest } from '../../services/document-upload-nest.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotebookDocument,
      DocumentChunk,
      NotebookChatMessage,
      NotebookSearchHistory,
    ]),
    RetrievalModule,
    LegalDomainModule,
    ChatModule,
  ],
  controllers: [NotebookController],
  providers: [
    NotebookService,
    DocumentProcessor,
    VectorStoreService,
    DocumentUploadServiceNest,
  ],
  exports: [NotebookService, DocumentUploadServiceNest],
})
export class NotebookModule {}

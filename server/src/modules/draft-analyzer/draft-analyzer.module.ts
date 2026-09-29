import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatModule } from '../chat/chat.module';
import { Draft } from './entities/draft.entity';
import { DraftPage } from './entities/draft-page.entity';
import { DraftTextBlock } from './entities/draft-text-block.entity';
import { DraftReviewFinding } from './entities/draft-review-finding.entity';
import { DraftAnalyzerService } from './draft-analyzer.service';
import { DraftAnalyzerController } from './draft-analyzer.controller';
import { ExtractionService } from './services/extraction.service';
import { PdfExtractorService } from './services/pdf-extractor.service';
import { DocxExtractorService } from './services/docx-extractor.service';
import { TxtExtractorService } from './services/txt-extractor.service';
import { AiReviewerService } from './services/ai-reviewer.service';
import { ProgressService } from './services/progress.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Draft, DraftPage, DraftTextBlock, DraftReviewFinding]),
    ChatModule,
  ],
  controllers: [DraftAnalyzerController],
  providers: [
    DraftAnalyzerService,
    ExtractionService,
    PdfExtractorService,
    DocxExtractorService,
    TxtExtractorService,
    AiReviewerService,
    ProgressService,
  ],
})
export class DraftAnalyzerModule {}

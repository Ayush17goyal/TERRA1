import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JudgmentController } from './judgment.controller';
import { JudgmentService } from './judgment.service';
import { JudgmentAnalysis } from './judgment-analysis.entity';
import { DocumentChunk } from '../notebook/chunk.entity';
import { NotebookDocument } from '../notebook/notebook.entity';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([JudgmentAnalysis, DocumentChunk, NotebookDocument]),
    ChatModule,
  ],
  controllers: [JudgmentController],
  providers: [JudgmentService],
  exports: [JudgmentService],
})
export class JudgmentModule {}


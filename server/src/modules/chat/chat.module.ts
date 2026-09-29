import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { LexMentorAiService } from './lexmentor-ai.service';
import { OpenRouterAiProviderService } from './openrouter-ai-provider.service';
import { GuideBotService } from './guidebot.service';
import { FallbackMetricsService } from './fallback-metrics.service';
import { TokenOptimizationService } from './token-optimization.service';
import { SemanticCacheService } from './semantic-cache.service';
import { LegalSearchFallbackService } from './legal-search-fallback.service';
import { LegalDomainModule } from '../legal-domain/legal-domain.module';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarEvent, Exam } from '../exam/exam.entities';
import { AuthorityVerificationEngine } from './lexmentor/authority-verification-engine.service';
import { CitationGenerator } from './lexmentor/citation-generator.service';
import { ContextBuilder } from './lexmentor/context-builder.service';
import { IntentClassifier } from './lexmentor/intent-classifier.service';
import { LegalReasoningEngine } from './lexmentor/legal-reasoning-engine.service';
import { LegalRetriever } from './lexmentor/legal-retriever.service';
import { Reranker } from './lexmentor/reranker.service';
import { ResponseFormatter } from './lexmentor/response-formatter.service';
import { ConversationMemoryService } from './lexmentor/conversation-memory.service';
import { ConversationSession, ConversationTurn, PipelineAnalyticRecord } from './lexmentor/conversation.entities';
import { QueryRewriter } from './lexmentor/query-rewriter.service';
import { QueryValidator } from './lexmentor/query-validator.service';
import { PipelineAnalyticsService } from './lexmentor/analytics.service';
import { LegalEvidenceValidator } from './lexmentor/legal-evidence-validator.service';

const lexMentorPipelineProviders = [
  IntentClassifier,
  QueryValidator,
  LegalRetriever,
  Reranker,
  ContextBuilder,
  LegalReasoningEngine,
  CitationGenerator,
  AuthorityVerificationEngine,
  ResponseFormatter,
  LegalEvidenceValidator,
];

@Module({
  imports: [
    LegalDomainModule,
    RetrievalModule,
    TypeOrmModule.forFeature([CalendarEvent, Exam, ConversationSession, ConversationTurn, PipelineAnalyticRecord]),
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    LexMentorAiService,
    OpenRouterAiProviderService,
    FallbackMetricsService,
    TokenOptimizationService,
    SemanticCacheService,
    LegalSearchFallbackService,
    ConversationMemoryService,
    QueryRewriter,
    PipelineAnalyticsService,
    GuideBotService,
    ...lexMentorPipelineProviders,
  ],
  exports: [
    ChatService,
    GuideBotService,
    OpenRouterAiProviderService,
    FallbackMetricsService,
    TokenOptimizationService,
    SemanticCacheService,
    LegalSearchFallbackService,
    AuthorityVerificationEngine,
    CitationGenerator,
  ],
})
export class ChatModule {}

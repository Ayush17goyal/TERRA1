"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatModule = void 0;
const common_1 = require("@nestjs/common");
const chat_controller_1 = require("./chat.controller");
const chat_service_1 = require("./chat.service");
const lexmentor_ai_service_1 = require("./lexmentor-ai.service");
const openrouter_ai_provider_service_1 = require("./openrouter-ai-provider.service");
const guidebot_service_1 = require("./guidebot.service");
const fallback_metrics_service_1 = require("./fallback-metrics.service");
const token_optimization_service_1 = require("./token-optimization.service");
const semantic_cache_service_1 = require("./semantic-cache.service");
const legal_search_fallback_service_1 = require("./legal-search-fallback.service");
const legal_domain_module_1 = require("../legal-domain/legal-domain.module");
const retrieval_module_1 = require("../retrieval/retrieval.module");
const typeorm_1 = require("@nestjs/typeorm");
const exam_entities_1 = require("../exam/exam.entities");
const authority_verification_engine_service_1 = require("./lexmentor/authority-verification-engine.service");
const citation_generator_service_1 = require("./lexmentor/citation-generator.service");
const context_builder_service_1 = require("./lexmentor/context-builder.service");
const intent_classifier_service_1 = require("./lexmentor/intent-classifier.service");
const legal_reasoning_engine_service_1 = require("./lexmentor/legal-reasoning-engine.service");
const legal_retriever_service_1 = require("./lexmentor/legal-retriever.service");
const reranker_service_1 = require("./lexmentor/reranker.service");
const response_formatter_service_1 = require("./lexmentor/response-formatter.service");
const conversation_memory_service_1 = require("./lexmentor/conversation-memory.service");
const conversation_entities_1 = require("./lexmentor/conversation.entities");
const query_rewriter_service_1 = require("./lexmentor/query-rewriter.service");
const query_validator_service_1 = require("./lexmentor/query-validator.service");
const analytics_service_1 = require("./lexmentor/analytics.service");
const legal_evidence_validator_service_1 = require("./lexmentor/legal-evidence-validator.service");
const lexMentorPipelineProviders = [
    intent_classifier_service_1.IntentClassifier,
    query_validator_service_1.QueryValidator,
    legal_retriever_service_1.LegalRetriever,
    reranker_service_1.Reranker,
    context_builder_service_1.ContextBuilder,
    legal_reasoning_engine_service_1.LegalReasoningEngine,
    citation_generator_service_1.CitationGenerator,
    authority_verification_engine_service_1.AuthorityVerificationEngine,
    response_formatter_service_1.ResponseFormatter,
    legal_evidence_validator_service_1.LegalEvidenceValidator,
];
let ChatModule = class ChatModule {
};
exports.ChatModule = ChatModule;
exports.ChatModule = ChatModule = __decorate([
    (0, common_1.Module)({
        imports: [
            legal_domain_module_1.LegalDomainModule,
            retrieval_module_1.RetrievalModule,
            typeorm_1.TypeOrmModule.forFeature([exam_entities_1.CalendarEvent, exam_entities_1.Exam, conversation_entities_1.ConversationSession, conversation_entities_1.ConversationTurn, conversation_entities_1.PipelineAnalyticRecord]),
        ],
        controllers: [chat_controller_1.ChatController],
        providers: [
            chat_service_1.ChatService,
            lexmentor_ai_service_1.LexMentorAiService,
            openrouter_ai_provider_service_1.OpenRouterAiProviderService,
            fallback_metrics_service_1.FallbackMetricsService,
            token_optimization_service_1.TokenOptimizationService,
            semantic_cache_service_1.SemanticCacheService,
            legal_search_fallback_service_1.LegalSearchFallbackService,
            conversation_memory_service_1.ConversationMemoryService,
            query_rewriter_service_1.QueryRewriter,
            analytics_service_1.PipelineAnalyticsService,
            guidebot_service_1.GuideBotService,
            ...lexMentorPipelineProviders,
        ],
        exports: [
            chat_service_1.ChatService,
            guidebot_service_1.GuideBotService,
            openrouter_ai_provider_service_1.OpenRouterAiProviderService,
            fallback_metrics_service_1.FallbackMetricsService,
            token_optimization_service_1.TokenOptimizationService,
            semantic_cache_service_1.SemanticCacheService,
            legal_search_fallback_service_1.LegalSearchFallbackService,
            authority_verification_engine_service_1.AuthorityVerificationEngine,
            citation_generator_service_1.CitationGenerator,
        ],
    })
], ChatModule);
//# sourceMappingURL=chat.module.js.map
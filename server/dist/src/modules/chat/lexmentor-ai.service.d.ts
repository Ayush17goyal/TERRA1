import { ConversationMemoryService } from './lexmentor/conversation-memory.service';
import { IntentClassifier } from './lexmentor/intent-classifier.service';
import { QueryRewriter } from './lexmentor/query-rewriter.service';
import { LegalRetriever } from './lexmentor/legal-retriever.service';
import { Reranker } from './lexmentor/reranker.service';
import { ContextBuilder } from './lexmentor/context-builder.service';
import { LegalReasoningEngine } from './lexmentor/legal-reasoning-engine.service';
import { CitationGenerator } from './lexmentor/citation-generator.service';
import { AuthorityVerificationEngine } from './lexmentor/authority-verification-engine.service';
import { ResponseFormatter } from './lexmentor/response-formatter.service';
import { PipelineAnalyticsService } from './lexmentor/analytics.service';
import { QueryValidator } from './lexmentor/query-validator.service';
import { LegalEvidenceValidator } from './lexmentor/legal-evidence-validator.service';
import { LexMentorResult } from './lexmentor/pipeline.types';
export type { LexMentorResult };
export type LexMentorInput = {
    query: string;
    depth?: string;
    history?: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>;
    userId?: string;
    sessionId?: string;
    onToken?: (token: string) => void;
    references?: Array<{
        id: string;
        content: string;
    }>;
};
export declare class LexMentorAiService {
    private readonly memory;
    private readonly intentClassifier;
    private readonly queryRewriter;
    private readonly legalRetriever;
    private readonly reranker;
    private readonly contextBuilder;
    private readonly reasoningEngine;
    private readonly citationGenerator;
    private readonly verificationEngine;
    private readonly formatter;
    private readonly analytics;
    private readonly queryValidator;
    private readonly legalEvidenceValidator;
    private readonly logger;
    constructor(memory: ConversationMemoryService, intentClassifier: IntentClassifier, queryRewriter: QueryRewriter, legalRetriever: LegalRetriever, reranker: Reranker, contextBuilder: ContextBuilder, reasoningEngine: LegalReasoningEngine, citationGenerator: CitationGenerator, verificationEngine: AuthorityVerificationEngine, formatter: ResponseFormatter, analytics: PipelineAnalyticsService, queryValidator: QueryValidator, legalEvidenceValidator: LegalEvidenceValidator);
    generateResponse(input: LexMentorInput): Promise<LexMentorResult>;
    private persistAndReturn;
    private buildResult;
    private toLegacyCitations;
    private timed;
    private timed_sync;
    private normalizeDepth;
    private genId;
}

"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const judgment_module_1 = require("./modules/judgment/judgment.module");
const chat_module_1 = require("./modules/chat/chat.module");
const contract_module_1 = require("./modules/contract/contract.module");
const notebook_module_1 = require("./modules/notebook/notebook.module");
const research_module_1 = require("./modules/research/research.module");
const retrieval_module_1 = require("./modules/retrieval/retrieval.module");
const ingestion_module_1 = require("./modules/ingestion/ingestion.module");
const exam_module_1 = require("./modules/exam/exam.module");
const founder_security_module_1 = require("./modules/founder-security/founder-security.module");
const settings_module_1 = require("./modules/settings/settings.module");
const learning_workspace_module_1 = require("./modules/learning-workspace/learning-workspace.module");
const student_verification_module_1 = require("./modules/student-verification/student-verification.module");
const health_module_1 = require("./modules/health/health.module");
const legal_intelligence_module_1 = require("./modules/legal-intelligence/legal-intelligence.module");
const live_session_module_1 = require("./modules/live-sessions/live-session.module");
const masterclass_module_1 = require("./modules/masterclass/masterclass.module");
const community_module_1 = require("./modules/community/community.module");
const payment_module_1 = require("./modules/payment/payment.module");
const draft_analyzer_module_1 = require("./modules/draft-analyzer/draft-analyzer.module");
const document_engine_module_1 = require("./modules/document-engine/document-engine.module");
const knowledge_engine_module_1 = require("./modules/knowledge-engine/knowledge-engine.module");
const question_planning_module_1 = require("./modules/question-planning/question-planning.module");
const question_bank_module_1 = require("./modules/question-bank/question-bank.module");
const model_answer_module_1 = require("./modules/model-answer/model-answer.module");
const mock_test_engine_module_1 = require("./modules/mock-test-engine/mock-test-engine.module");
const answer_evaluation_module_1 = require("./modules/answer-evaluation/answer-evaluation.module");
const analytics_engine_module_1 = require("./modules/analytics-engine/analytics-engine.module");
const learning_intelligence_module_1 = require("./modules/learning-intelligence/learning-intelligence.module");
const legislative_drafting_mentor_module_1 = require("./modules/legislative-drafting-mentor/legislative-drafting-mentor.module");
const memorial_workflow_module_1 = require("./modules/memorial/memorial-workflow.module");
const hardening_module_1 = require("./hardening/hardening.module");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const environment_1 = require("./hardening/config/environment");
dotenv.config();
const env = (0, environment_1.loadEnvironment)();
const isProduction = env.NODE_ENV === 'production';
const postgresUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const defaultSqlitePath = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'LEGATRIXON', 'legatrixon_db.sqlite')
    : path.resolve(process.cwd(), 'runtime', 'legatrixon_db.sqlite');
function resolveWritableSqlitePath() {
    const requestedPath = process.env.SQLITE_DB_PATH || defaultSqlitePath;
    const fallbackPath = path.join(process.env.TEMP || process.env.TMP || process.cwd(), 'LEGATRIXON', 'legatrixon_db.sqlite');
    const candidates = Array.from(new Set([requestedPath, fallbackPath]));
    for (const candidate of candidates) {
        try {
            fs.mkdirSync(path.dirname(candidate), { recursive: true });
            const fd = fs.openSync(candidate, 'a');
            fs.closeSync(fd);
            return candidate;
        }
        catch (error) {
            console.warn(`[LEGATRIXON SERVER] SQLite path is not writable, trying fallback. Path: ${candidate}. Reason: ${error.message}`);
        }
    }
    throw new Error('No writable SQLite database path is available. Set SQLITE_DB_PATH to a writable location.');
}
const sqliteDatabasePath = resolveWritableSqlitePath();
const databaseOptions = postgresUrl
    ? {
        type: 'postgres',
        url: postgresUrl,
        ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: isProduction,
        migrationsTableName: 'typeorm_migrations',
    }
    : {
        type: 'sqlite',
        database: sqliteDatabasePath,
        autoLoadEntities: true,
        synchronize: !isProduction,
        migrationsRun: false,
        extra: {
            busy_timeout: 30000,
        },
    };
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forRoot(databaseOptions),
            judgment_module_1.JudgmentModule,
            chat_module_1.ChatModule,
            contract_module_1.ContractModule,
            notebook_module_1.NotebookModule,
            research_module_1.ResearchModule,
            retrieval_module_1.RetrievalModule,
            ingestion_module_1.IngestionModule,
            document_engine_module_1.DocumentEngineModule,
            knowledge_engine_module_1.KnowledgeEngineModule,
            question_planning_module_1.QuestionPlanningModule,
            question_bank_module_1.QuestionBankModule,
            model_answer_module_1.ModelAnswerModule,
            mock_test_engine_module_1.MockTestEngineModule,
            answer_evaluation_module_1.AnswerEvaluationModule,
            analytics_engine_module_1.AnalyticsEngineModule,
            learning_intelligence_module_1.LearningIntelligenceModule,
            exam_module_1.ExamModule,
            founder_security_module_1.FounderSecurityModule,
            settings_module_1.SettingsModule,
            learning_workspace_module_1.LearningWorkspaceModule,
            student_verification_module_1.StudentVerificationModule,
            legal_intelligence_module_1.LegalIntelligenceModule,
            live_session_module_1.LiveSessionModule,
            masterclass_module_1.MasterclassModule,
            community_module_1.CommunityModule,
            payment_module_1.PaymentModule,
            draft_analyzer_module_1.DraftAnalyzerModule,
            legislative_drafting_mentor_module_1.LegislativeDraftingMentorModule,
            memorial_workflow_module_1.MemorialWorkflowModule,
            health_module_1.HealthModule,
            hardening_module_1.HardeningModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map
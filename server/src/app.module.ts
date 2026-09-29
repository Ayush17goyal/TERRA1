import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { JudgmentModule } from './modules/judgment/judgment.module';
import { ChatModule } from './modules/chat/chat.module';
import { ContractModule } from './modules/contract/contract.module';
import { NotebookModule } from './modules/notebook/notebook.module';
import { ResearchModule } from './modules/research/research.module';
import { RetrievalModule } from './modules/retrieval/retrieval.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { ExamModule } from './modules/exam/exam.module';
import { FounderSecurityModule } from './modules/founder-security/founder-security.module';
import { SettingsModule } from './modules/settings/settings.module';
import { LearningWorkspaceModule } from './modules/learning-workspace/learning-workspace.module';
import { StudentVerificationModule } from './modules/student-verification/student-verification.module';
import { HealthModule } from './modules/health/health.module';
import { LegalIntelligenceModule } from './modules/legal-intelligence/legal-intelligence.module';
import { LiveSessionModule } from './modules/live-sessions/live-session.module';
import { MasterclassModule } from './modules/masterclass/masterclass.module';
import { CommunityModule } from './modules/community/community.module';
import { PaymentModule } from './modules/payment/payment.module';
import { DraftAnalyzerModule } from './modules/draft-analyzer/draft-analyzer.module';
import { DocumentEngineModule } from './modules/document-engine/document-engine.module';
import { KnowledgeEngineModule } from './modules/knowledge-engine/knowledge-engine.module';
import { QuestionPlanningModule } from './modules/question-planning/question-planning.module';
import { QuestionBankModule } from './modules/question-bank/question-bank.module';
import { ModelAnswerModule } from './modules/model-answer/model-answer.module';
import { MockTestEngineModule } from './modules/mock-test-engine/mock-test-engine.module';
import { AnswerEvaluationModule } from './modules/answer-evaluation/answer-evaluation.module';
import { AnalyticsEngineModule } from './modules/analytics-engine/analytics-engine.module';
import { LearningIntelligenceModule } from './modules/learning-intelligence/learning-intelligence.module';
import { LegislativeDraftingMentorModule } from './modules/legislative-drafting-mentor/legislative-drafting-mentor.module';
import { HardeningModule } from './hardening/hardening.module';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { loadEnvironment } from './hardening/config/environment';

dotenv.config();
const env = loadEnvironment();
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
    } catch (error: any) {
      console.warn(`[LEGATRIXON SERVER] SQLite path is not writable, trying fallback. Path: ${candidate}. Reason: ${error.message}`);
    }
  }

  throw new Error('No writable SQLite database path is available. Set SQLITE_DB_PATH to a writable location.');
}

const sqliteDatabasePath = resolveWritableSqlitePath();

const databaseOptions: TypeOrmModuleOptions = postgresUrl
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

@Module({
  imports: [
    TypeOrmModule.forRoot(databaseOptions),
    JudgmentModule,
    ChatModule,
    ContractModule,
    NotebookModule,
    ResearchModule,
    RetrievalModule,
    IngestionModule,
    DocumentEngineModule,
    KnowledgeEngineModule,
    QuestionPlanningModule,
    QuestionBankModule,
    ModelAnswerModule,
    MockTestEngineModule,
    AnswerEvaluationModule,
    AnalyticsEngineModule,
    LearningIntelligenceModule,
    ExamModule,
    FounderSecurityModule,
    SettingsModule,
    LearningWorkspaceModule,
    StudentVerificationModule,
    LegalIntelligenceModule,
    LiveSessionModule,
    MasterclassModule,
    CommunityModule,
    PaymentModule,
    DraftAnalyzerModule,
    LegislativeDraftingMentorModule,
    HealthModule,
    HardeningModule,
  ],
})
export class AppModule {}
















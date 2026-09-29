import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables before any NestJS bootstrap
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngestionModule } from '../modules/ingestion/ingestion.module';
import { CorpusScannerService } from '../modules/ingestion/corpus-scanner.service';
import { SettingsModule } from '../modules/settings/settings.module';

// ─── SQLite path resolution ───────────────────────────────────────────────────
const defaultSqlitePath = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'LEGATRIXON', 'legatrixon_db.sqlite')
  : path.resolve(process.cwd(), 'legatrixon_db.sqlite');

const sqliteDatabasePath = process.env.SQLITE_DB_PATH || defaultSqlitePath;

// ─── Minimal CLI NestJS module ────────────────────────────────────────────────
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: sqliteDatabasePath,
      autoLoadEntities: true,
      synchronize: true, // Auto-migrate schema changes (new columns etc.)
    }),
    SettingsModule,
    IngestionModule,
  ],
})
export class IngestionCliModule {}

// ─── Entry point ──────────────────────────────────────────────────────────────
async function runIngestion() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  LEGATRIXON — Production Legal Corpus Ingestion');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  SQLite database : ${sqliteDatabasePath}`);
  console.log(`  Qdrant URL      : ${process.env.QDRANT_URL || 'http://localhost:6333'}`);
  console.log(`  Qdrant collection: legal_corpus`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const app = await NestFactory.createApplicationContext(IngestionCliModule, {
    logger: ['error', 'warn', 'log'],
  });

  const scanner = app.get(CorpusScannerService);

  try {
    // Default to corpus-data relative to the server package root
    const corpusDir = process.env.CORPUS_DIR
      ? path.resolve(process.env.CORPUS_DIR)
      : path.resolve(__dirname, '../../../corpus-data');

    console.log(`  Corpus directory : ${corpusDir}\n`);

    const report = await scanner.scanCorpus(corpusDir);

    if (report.errors > 0) {
      process.exitCode = 1;
    }
  } catch (err: any) {
    console.error('❌ Ingestion run failed with unhandled error:', err.message);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

runIngestion();

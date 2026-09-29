import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngestionModule } from '../modules/ingestion/ingestion.module';
import { CorpusScannerService } from '../modules/ingestion/corpus-scanner.service';
import { SettingsModule } from '../modules/settings/settings.module';

const defaultSqlitePath = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'LEGATRIXON', 'legatrixon_db.sqlite')
  : path.resolve(process.cwd(), 'legatrixon_db.sqlite');

const sqliteDatabasePath = process.env.SQLITE_DB_PATH || defaultSqlitePath;

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: sqliteDatabasePath,
      autoLoadEntities: true,
      synchronize: true,
    }),
    SettingsModule,
    IngestionModule,
  ],
})
export class TestCliModule {}

async function runScan() {
  console.log('⚡ Bootstrapping NestJS test context...');
  const app = await NestFactory.createApplicationContext(TestCliModule, {
    logger: ['error', 'warn', 'log'],
  });

  const scanner = app.get(CorpusScannerService);

  console.log('\n--- Starting Legal PDF Ingestion Directory Scan ---');
  try {
    const report = await scanner.scanCorpus();
    console.log(`\n✅ Scan completed!`);
    console.log(`   Acts discovered: ${report.actsDiscovered}`);
    console.log(`   Acts parsed:     ${report.actsParsed}`);
    console.log(`   Acts skipped:    ${report.actsSkipped}`);
    console.log(`   Sections stored: ${report.sectionsStored}`);
    console.log(`   Embeddings:      ${report.embeddingsGenerated}`);
    console.log(`   Errors:          ${report.errors}`);
  } catch (err) {
    console.error('❌ Scan failed:', err);
  } finally {
    await app.close();
  }
}

runScan();

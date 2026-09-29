import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { IngestionModule } from '../modules/ingestion/ingestion.module';
import { RetrievalModule } from '../modules/retrieval/retrieval.module';
import { LegalIntelligenceModule } from '../modules/legal-intelligence/legal-intelligence.module';
import { SettingsModule } from '../modules/settings/settings.module';
import { ChatModule } from '../modules/chat/chat.module';

import { LegalIntelligenceService } from '../modules/legal-intelligence/legal-intelligence.service';

const defaultSqlitePath = process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA || '', 'LEGATRIXON', 'legatrixon_db.sqlite')
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
    RetrievalModule,
    LegalIntelligenceModule,
    ChatModule,
  ],
})
class TestBareActAiModule {}

async function testBareActAi() {
  console.log('⚡ Bootstrapping NestJS test context for Bare Act AI...');
  let app;
  try {
    app = await NestFactory.createApplicationContext(TestBareActAiModule, { logger: false });
    console.log('NestJS context initialized successfully.');
  } catch (err: any) {
    console.error('❌ Failed to bootstrap context:', err.message);
    process.exit(1);
  }

  const bareActAiService = app.get(LegalIntelligenceService);

  const testQueries = [
    { userInput: 'what is the explanation of Limitation Act Section 5?' },
    { userInput: 'Can you write a Python script to scrape a website?' },
    { userInput: 'What does Special Marriage Act Section 4 say?' }
  ];

  for (const q of testQueries) {
    console.log(`\n======================================================`);
    console.log(`🔍 USER INPUT: "${q.userInput}"`);
    console.log(`======================================================`);
    
    try {
      const response = await bareActAiService.professorChat('mock_user_123', q);
      console.log('📌 BARE ACT AI RESPONSE:\n');
      console.log(response.response);
      console.log('\n--- Metadata ---');
      console.log(`- Act Detected: ${response.act}`);
      console.log(`- Source:       ${response.source}`);
      console.log(`- Low Confidence (Missing Context): ${response.lowConfidence}`);
    } catch (err) {
      console.error(`❌ Error querying Bare Act AI:`, err);
    }
  }

  await app.close();
  process.exit(0);
}

testBareActAi();

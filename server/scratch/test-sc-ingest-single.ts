import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { IngestionService } from '../src/modules/ingestion/ingestion.service';

async function testSingleIngest() {
  console.log('⚡ Bootstrapping NestJS...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const ingestionService = app.get(IngestionService);
  const filePath = path.resolve(__dirname, '../corpus-data/supreme-court/1436778398816-Rai Sahib Ram Jawaya Kapur v. The State of Punjab.pdf');

  console.log(`\n📄 Testing ingestion of: ${filePath}`);
  try {
    const result = await ingestionService.ingestDocument(
      'supreme_court_cases',
      filePath,
      { court: 'Supreme Court of India', documentType: 'supreme_court_cases' },
      { chunkSize: 1200, chunkOverlap: 250 }
    );
    console.log('\n=========================================');
    console.log('Ingestion Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('=========================================');
  } catch (error: any) {
    console.error('❌ Ingestion failed:', error);
  }

  await app.close();
}

testSingleIngest().catch(console.error);

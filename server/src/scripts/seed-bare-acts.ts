/**
 * Seed BNS, BNSS, BSA into Qdrant using OpenAI embeddings fallback.
 * Run from server/ directory:
 *   npx ts-node -r tsconfig-paths/register src/scripts/seed-bare-acts.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { IngestionService } from '../modules/ingestion/ingestion.service';

const ACTS = [
  {
    type: 'bns' as const,
    dir: path.resolve(__dirname, '../../corpus-data/bns'),
    metadata: { title: 'Bharatiya Nyaya Sanhita', documentType: 'bns', act: 'BNS' },
  },
  {
    type: 'bnss' as const,
    dir: path.resolve(__dirname, '../../corpus-data/bnss'),
    metadata: { title: 'Bharatiya Nagarik Suraksha Sanhita', documentType: 'bnss', act: 'BNSS' },
  },
  {
    type: 'act' as const,
    dir: path.resolve(__dirname, '../../corpus-data/bsa'),
    metadata: { act_name: 'Bharatiya Sakshya Adhiniyam', documentType: 'bare_acts', act: 'BSA' },
  },
];

async function main() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  LEGATRIXON — Bare Act Corpus Seeder        ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const svc = app.get(IngestionService);

  // Initialize collections
  console.log('🔧 Initializing Qdrant collections...');
  await svc.initializeCollections();
  console.log('✅ Collections ready.\n');

  let totalChunks = 0;
  let totalPoints = 0;

  for (const act of ACTS) {
    console.log(`\n📚 Ingesting ${act.metadata.act} from: ${act.dir}`);
    console.log('─'.repeat(55));

    const result = await svc.ingestDirectory(
      act.type,
      act.dir,
      act.metadata,
      { chunkSize: 800, chunkOverlap: 150 },
    );

    console.log(`   Files:   ${result.totalDocuments}`);
    console.log(`   Success: ${result.successful}`);
    console.log(`   Failed:  ${result.failed}`);

    for (const r of result.results) {
      if (r.errors.length > 0) {
        console.log(`   ❌ ${r.fileName}: ${r.errors.join(', ')}`);
      } else {
        console.log(`   ✅ ${r.fileName}: ${r.chunksGenerated} chunks → ${r.pointsUpserted} vectors`);
        totalChunks += r.chunksGenerated;
        totalPoints += r.pointsUpserted;
      }
    }
  }

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log(`║  DONE — ${totalChunks} chunks, ${totalPoints} vectors stored`);
  console.log('╚══════════════════════════════════════════════╝\n');

  await app.close();
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});

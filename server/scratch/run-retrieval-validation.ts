import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { BgeM3Provider } from '../src/modules/retrieval/bge-m3.provider';
import { QdrantService } from '../src/modules/retrieval/qdrant.service';

async function runValidationAudit() {
  console.log('⚡ Bootstrapping NestJS...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const bgeM3Provider = app.get(BgeM3Provider);
  const qdrantService = app.get(QdrantService);
  const client = qdrantService.getClient();

  const queries = [
    'Article 14',
    'Article 19',
    'Article 21',
    'Basic Structure Doctrine',
    'Kesavananda Bharati',
    'Maneka Gandhi',
    'Section 103 BNS',
    'Section 303 BNS'
  ];

  // The collections searched by LexMentor
  const lexMentorCollections = [
    { name: 'constitution', label: 'Constitution' },
    { name: 'bare_acts', label: 'Bare Acts' },
    { name: 'supreme_court_cases', label: 'Supreme Court Cases' },
    { name: 'high_court_cases', label: 'High Court Cases' },
    { name: 'research_papers', label: 'Research Papers' },
    { name: 'user_documents', label: 'User Documents' },
    { name: 'acts', label: 'Bare Acts (Legacy)' },
    { name: 'judgments', label: 'Judgments (Legacy)' }
  ];

  // Include new bge schema collections to audit potential gaps
  const additionalCollections = [
    { name: 'bns_bge', label: 'BNS (BGE)' },
    { name: 'bnss_bge', label: 'BNSS (BGE)' },
    { name: 'acts_bge', label: 'Acts (BGE)' },
    { name: 'judgments_bge', label: 'Judgments (BGE)' }
  ];

  const allSearchableCollections = [...lexMentorCollections, ...additionalCollections];

  console.log('\n========================================================================');
  console.log('                      RETRIEVAL VALIDATION AUDIT                        ');
  console.log('========================================================================');

  const auditReport: any[] = [];

  for (const query of queries) {
    console.log(`\n🔍 Querying: "${query}"...`);
    
    // Generate Embedding
    let vector: number[];
    try {
      vector = await bgeM3Provider.generateEmbedding(query);
    } catch (err: any) {
      console.error(`  ❌ Failed to generate embedding: ${err.message}`);
      continue;
    }

    const hitsFound: any[] = [];

    // Search all collections
    await Promise.all(allSearchableCollections.map(async (col) => {
      try {
        const hits = await client.search(col.name, {
          vector,
          limit: 3,
          with_payload: true
        });

        hits.forEach(hit => {
          hitsFound.push({
            collection: col.name,
            label: col.label,
            score: Number(hit.score || 0),
            payload: hit.payload || {},
            id: hit.id
          });
        });
      } catch (err: any) {
        // Silent catch for missing/empty collections
      }
    }));

    // Sort by score descending
    hitsFound.sort((a, b) => b.score - a.score);

    // Filter top 3 hits overall
    const topHits = hitsFound.slice(0, 3);

    console.log(`  Top matches found: ${topHits.length}`);
    topHits.forEach((hit, idx) => {
      const text = hit.payload.text || hit.payload.content || '';
      const source = hit.payload.title || hit.payload.fileName || hit.payload.source || 'Unknown Source';
      console.log(`    [${idx + 1}] Collection: ${hit.collection} | Score: ${hit.score.toFixed(4)}`);
      console.log(`        Source: ${source}`);
      console.log(`        Snippet: ${JSON.stringify(text.substring(0, 150))}...`);
    });

    auditReport.push({
      query,
      collectionsSearched: allSearchableCollections.map(c => c.name).join(', '),
      topHits: topHits.map(h => ({
        collection: h.collection,
        score: h.score,
        source: h.payload.title || h.payload.fileName || h.payload.source || 'Unknown',
        excerpt: h.payload.text || h.payload.content || ''
      }))
    });
  }

  // Write report
  fs.writeFileSync(
    path.join(__dirname, 'retrieval-validation-results.json'),
    JSON.stringify(auditReport, null, 2)
  );
  console.log(`\nWritten validation results to: ${path.join(__dirname, 'retrieval-validation-results.json')}`);

  await app.close();
}

runValidationAudit().catch(console.error);

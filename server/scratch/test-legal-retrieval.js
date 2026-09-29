const { NestFactory } = require('@nestjs/core');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { TestCliModule } = require('../dist/src/scripts/test-corpus-scan'); // reusing CLI wrapper module
const { LegalRetrievalService } = require('../dist/src/modules/retrieval/legal-retrieval.service');

async function testRetrieval() {
  console.log('⚡ Bootstrapping NestJS test context...');
  const app = await NestFactory.createApplicationContext(TestCliModule, { logger: false });
  console.log('NestJS context initialized successfully.');

  const retrievalService = app.get(LegalRetrievalService);

  const testQueries = [
    'Limitation Act Section 5',
    'what is the time limit to file suit for contract breach under Limitation Act?',
    'Is there any proviso or extension under Limitation Act?',
    'Show me the explanation of Limitation Act Section 5',
    'What does Special Marriage Act Section 4 say?'
  ];

  for (const q of testQueries) {
    console.log(`\n======================================================`);
    console.log(`🔍 QUERY: "${q}"`);
    console.log(`======================================================`);
    
    try {
      const response = await retrievalService.retrieveLegalContext(q, 3);
      
      console.log('📌 DETECTED INTENT:');
      console.log(`- Act Name:      "${response.detectedActName || 'N/A'}"`);
      console.log(`- Provision Type: "${response.detectedType}"`);
      console.log(`- Number:         "${response.detectedNumber || 'N/A'}"`);
      
      console.log(`\n📋 RETRIEVED PROVISIONS (${response.provisions.length}):`);
      response.provisions.forEach((prov, idx) => {
        console.log(`\n  [Provision ${idx + 1}] ID: ${prov.id} | Score: ${prov.score.toFixed(4)}`);
        console.log(`  - Act: ${prov.actName} | Section: ${prov.section || 'N/A'} | Subsection: ${prov.subsection || 'N/A'} | Clause: ${prov.clause || 'N/A'}`);
        console.log(`  - Title: "${prov.title || 'N/A'}"`);
        console.log(`  - Keywords: ${prov.keywords.join(', ')}`);
        console.log(`  - Content: "${prov.content.substring(0, 150).replace(/\n/g, ' ')}..."`);
      });
    } catch (err) {
      console.error(`❌ Error retrieving context:`, err.message);
    }
  }

  await app.close();
}

testRetrieval();

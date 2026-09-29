const { QdrantClient } = require('@qdrant/js-client-rest');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
const rawApiKey = process.env.QDRANT_API_KEY || '';
const isLocalHttp = /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(qdrantUrl);
const apiKey = rawApiKey && !isLocalHttp ? rawApiKey : undefined;

console.log('Connecting to Qdrant at:', qdrantUrl);

const client = new QdrantClient({ url: qdrantUrl, apiKey });

async function run() {
  try {
    const collectionName = 'acts_bge';
    console.log(`Creating payload index for 'pdf_source' in collection '${collectionName}'...`);
    
    await client.createPayloadIndex(collectionName, {
      field_name: 'pdf_source',
      field_schema: 'keyword',
    });

    console.log('Index created successfully! Retrying scroll query...');
    
    const scrollResult = await client.scroll(collectionName, {
      filter: {
        must: [
          {
            key: 'pdf_source',
            match: { value: 'test' }
          }
        ]
      },
      limit: 1
    });

    console.log('Scroll check success! Found matching items:', scrollResult.points.length);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();

const { QdrantClient } = require('@qdrant/js-client-rest');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
const rawApiKey = process.env.QDRANT_API_KEY || '';
const isLocalHttp = /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(qdrantUrl);
const apiKey = rawApiKey && !isLocalHttp ? rawApiKey : undefined;

console.log('Connecting to Qdrant at:', qdrantUrl);
console.log('Has API key:', !!apiKey);

const client = new QdrantClient({ url: qdrantUrl, apiKey });

async function run() {
  try {
    const collections = await client.getCollections();
    console.log('Collections list:', JSON.stringify(collections, null, 2));

    const collectionName = 'acts_bge';
    
    // Check if acts_bge exists
    const exists = collections.collections.some(c => c.name === collectionName);
    console.log(`Collection "${collectionName}" exists:`, exists);

    if (exists) {
      const info = await client.getCollection(collectionName);
      console.log('Collection info:', JSON.stringify(info, null, 2));

      // Test scroll with simple match filter
      console.log('Testing scroll with pdf_source filter...');
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
      console.log('Scroll success! Found:', scrollResult.points.length);
    }
  } catch (err) {
    console.error('Error during Qdrant test:', err.message);
    if (err.stack) console.error(err.stack);
  }
}

run();

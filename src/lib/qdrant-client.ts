import { QdrantClient } from '@qdrant/js-client-rest';

// Environment variables configuration (using standard Node/Next config)
const qdrantUrl = typeof process !== 'undefined' ? process.env.QDRANT_URL : undefined;
const qdrantApiKey = typeof process !== 'undefined' ? process.env.QDRANT_API_KEY : undefined;

export const qdrantClient = new QdrantClient({
  url: qdrantUrl || 'http://localhost:6333',
  apiKey: qdrantApiKey || undefined,
});

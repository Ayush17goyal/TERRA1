import { qdrantClient } from '../lib/qdrant-client';
import type { QdrantService } from './qdrant.service';
import type { EmbeddingService } from './embedding.service';

// Dynamically resolve collection names from environment variables with defaults
const COL_JUDGMENTS = (typeof process !== 'undefined' ? process.env.QDRANT_COLLECTION_JUDGMENTS : undefined) || 'judgments';
const COL_ACTS = (typeof process !== 'undefined' ? process.env.QDRANT_COLLECTION_ACTS : undefined) || 'acts';
const COL_RESEARCH_PAPERS = (typeof process !== 'undefined' ? process.env.QDRANT_COLLECTION_RESEARCH_PAPERS : undefined) || 'research_papers';
const COL_LAW_COMMISSION_REPORTS = (typeof process !== 'undefined' ? process.env.QDRANT_COLLECTION_LAW_COMMISSION_REPORTS : undefined) || 'law_commission_reports';
const COL_USER_DOCUMENTS = (typeof process !== 'undefined' ? process.env.QDRANT_COLLECTION_USER_DOCUMENTS : undefined) || 'user_documents';

export class VectorSearchService {
  private qdrantService: QdrantService;
  private embeddingService: EmbeddingService;

  constructor(qdrantService: QdrantService, embeddingService: EmbeddingService) {
    this.qdrantService = qdrantService;
    this.embeddingService = embeddingService;
  }

  /**
   * Run telemetry check on vector database
   */
  async checkDatabaseHealth() {
    return this.qdrantService.healthCheck();
  }

  /**
   * Search judgments collection
   */
  async searchJudgments(query: string, topK: number = 5, filter?: any, scoreThreshold?: number) {
    return this.searchCollection(COL_JUDGMENTS, query, topK, filter, scoreThreshold);
  }

  /**
   * Search acts/statutes collection
   */
  async searchActs(query: string, topK: number = 5, filter?: any, scoreThreshold?: number) {
    return this.searchCollection(COL_ACTS, query, topK, filter, scoreThreshold);
  }

  /**
   * Search academic research papers collection
   */
  async searchResearchPapers(query: string, topK: number = 5, filter?: any, scoreThreshold?: number) {
    return this.searchCollection(COL_RESEARCH_PAPERS, query, topK, filter, scoreThreshold);
  }

  /**
   * Search law commission reports collection
   */
  async searchLawCommissionReports(query: string, topK: number = 5, filter?: any, scoreThreshold?: number) {
    return this.searchCollection(COL_LAW_COMMISSION_REPORTS, query, topK, filter, scoreThreshold);
  }

  /**
   * Search user uploads and drafts collection
   */
  async searchUserDocuments(query: string, topK: number = 5, filter?: any, scoreThreshold?: number) {
    return this.searchCollection(COL_USER_DOCUMENTS, query, topK, filter, scoreThreshold);
  }

  /**
   * Search for similar documents based on an existing point in Qdrant (Recommendations)
   */
  async similarDocuments(
    collection: string,
    docId: string | number,
    topK: number = 5,
    filter?: any,
    scoreThreshold?: number
  ): Promise<any[]> {
    try {
      console.log(`[VectorSearchService] Recommending similar entries to point "${docId}" in collection "${collection}"`);
      const response = await qdrantClient.recommend(collection, {
        positive: [docId],
        limit: topK,
        filter,
        score_threshold: scoreThreshold,
        with_payload: true,
      });

      return response.map(hit => ({
        id: hit.id,
        score: hit.score,
        payload: hit.payload,
      }));
    } catch (error: any) {
      console.error(`[VectorSearchService] Recommendation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Query across multiple collections simultaneously, combining and sorting results by score
   */
  async searchAcrossCollections(
    query: string,
    collections: string[] = [COL_JUDGMENTS, COL_ACTS, COL_RESEARCH_PAPERS, COL_LAW_COMMISSION_REPORTS, COL_USER_DOCUMENTS],
    topK: number = 5,
    filter?: any,
    scoreThreshold?: number
  ): Promise<any[]> {
    console.log(`[VectorSearchService] Searching across collections: [${collections.join(', ')}] for query: "${query}"`);
    
    if (!query || query.trim() === '') {
      return [];
    }

    const vector = await this.embeddingService.generateEmbedding(query);
    
    const searchPromises = collections.map(async (collection) => {
      try {
        const results = await qdrantClient.search(collection, {
          vector,
          limit: topK,
          filter,
          score_threshold: scoreThreshold,
          with_payload: true,
        });
        return results.map(hit => ({
          collection,
          id: hit.id,
          score: hit.score,
          payload: hit.payload,
        }));
      } catch (err: any) {
        console.warn(`[VectorSearchService] Search in collection "${collection}" failed: ${err.message}`);
        return [];
      }
    });

    const results = await Promise.all(searchPromises);
    const combined = results.flat();

    // Sort by vector similarity score descending
    combined.sort((a, b) => b.score - a.score);
    return combined.slice(0, topK);
  }

  /**
   * Shared private search helper
   */
  private async searchCollection(
    collection: string,
    query: string,
    topK: number = 5,
    filter?: any,
    scoreThreshold?: number
  ): Promise<any[]> {
    try {
      console.log(`[VectorSearchService] Querying collection "${collection}" (topK: ${topK}, threshold: ${scoreThreshold || 'none'})`);
      
      if (!query || query.trim() === '') {
        console.log(`[VectorSearchService] Empty search query. Returning empty result.`);
        return [];
      }

      const vector = await this.embeddingService.generateEmbedding(query);

      const results = await qdrantClient.search(collection, {
        vector,
        limit: topK,
        filter,
        score_threshold: scoreThreshold,
        with_payload: true,
      });

      return results.map(hit => ({
        id: hit.id,
        score: hit.score,
        payload: hit.payload,
      }));
    } catch (error: any) {
      console.error(`[VectorSearchService] Search query failed in collection "${collection}": ${error.message}`);
      throw error;
    }
  }
}

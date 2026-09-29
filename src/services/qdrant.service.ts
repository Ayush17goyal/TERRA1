import { qdrantClient } from '../lib/qdrant-client';
import type { PointStruct } from '../types/qdrant.types';

export class QdrantService {
  private maxRetries = 3;
  private retryDelayMs = 1000;

  /**
   * Helper to execute Qdrant operations with a retry strategy
   */
  private async executeWithRetry<T>(operationName: string, operation: () => Promise<T>): Promise<T> {
    let lastError: any;
    let delay = this.retryDelayMs;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        // Check for common connection errors
        const isTransient = 
          error.message?.includes('fetch failed') || 
          error.message?.includes('ECONNREFUSED') || 
          error.message?.includes('ETIMEDOUT') ||
          error.status >= 500;

        if (!isTransient || attempt === this.maxRetries) {
          break;
        }

        console.warn(
          `[QdrantService] ${operationName} failed (attempt ${attempt}/${this.maxRetries}): ${error.message}. Retrying in ${delay}ms...`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }

    console.error(`[QdrantService] ${operationName} failed after ${this.maxRetries} attempts: ${lastError.message}`);
    throw lastError;
  }

  /**
   * Create a new collection in Qdrant
   */
  async createCollection(
    name: string,
    vectorSize: number = 1536,
    distance: 'Cosine' | 'Euclid' | 'Dot' = 'Cosine'
  ): Promise<boolean> {
    console.log(`[QdrantService] Initiating creation of collection: "${name}" (size: ${vectorSize}, distance: ${distance})`);
    
    return this.executeWithRetry(`createCollection(${name})`, async () => {
      // Check if collection already exists first
      const collectionsResponse = await qdrantClient.getCollections();
      const exists = collectionsResponse.collections.some(c => c.name === name);

      if (exists) {
        console.log(`[QdrantService] Collection "${name}" already exists. Skipping creation.`);
        return false;
      }

      await qdrantClient.createCollection(name, {
        vectors: {
          size: vectorSize,
          distance: distance as any,
        },
      });
      
      console.log(`[QdrantService] Collection "${name}" created successfully.`);
      return true;
    });
  }

  /**
   * Delete an existing collection in Qdrant
   */
  async deleteCollection(name: string): Promise<boolean> {
    console.log(`[QdrantService] Initiating deletion of collection: "${name}"`);
    
    return this.executeWithRetry(`deleteCollection(${name})`, async () => {
      const collectionsResponse = await qdrantClient.getCollections();
      const exists = collectionsResponse.collections.some(c => c.name === name);

      if (!exists) {
        console.warn(`[QdrantService] Collection "${name}" not found. Cannot delete.`);
        return false;
      }

      await qdrantClient.deleteCollection(name);
      console.log(`[QdrantService] Collection "${name}" deleted successfully.`);
      return true;
    });
  }

  /**
   * Upsert a single point (vector + payload)
   */
  async upsertPoint(collection: string, point: PointStruct): Promise<void> {
    console.log(`[QdrantService] Upserting point ${point.id} to collection "${collection}"`);
    
    await this.executeWithRetry(`upsertPoint(${collection}, ${point.id})`, async () => {
      await qdrantClient.upsert(collection, {
        wait: true,
        points: [point],
      });
      console.log(`[QdrantService] Point ${point.id} upserted successfully.`);
    });
  }

  /**
   * Batch upsert points to a collection
   */
  async upsertBatch(collection: string, points: PointStruct[]): Promise<void> {
    if (points.length === 0) {
      console.log(`[QdrantService] Empty batch provided for collection "${collection}". Skipping upsert.`);
      return;
    }
    
    console.log(`[QdrantService] Batch upserting ${points.length} points to collection "${collection}"`);
    
    await this.executeWithRetry(`upsertBatch(${collection})`, async () => {
      await qdrantClient.upsert(collection, {
        wait: true,
        points,
      });
      console.log(`[QdrantService] Batch upsert of ${points.length} points completed successfully.`);
    });
  }

  /**
   * Delete a single point by ID
   */
  async deletePoint(collection: string, pointId: string | number): Promise<void> {
    console.log(`[QdrantService] Deleting point ${pointId} from collection "${collection}"`);
    
    await this.executeWithRetry(`deletePoint(${collection}, ${pointId})`, async () => {
      await qdrantClient.delete(collection, {
        points: [pointId],
      });
      console.log(`[QdrantService] Point ${pointId} deleted successfully.`);
    });
  }

  /**
   * Retrieve statistics and schema metadata of a collection
   */
  async getCollectionInfo(collection: string): Promise<any> {
    console.log(`[QdrantService] Fetching metadata info for collection "${collection}"`);
    
    return this.executeWithRetry(`getCollectionInfo(${collection})`, async () => {
      try {
        const info = await qdrantClient.getCollection(collection);
        return info;
      } catch (error: any) {
        if (error.status === 404 || error.message?.includes('not found')) {
          console.warn(`[QdrantService] Collection "${collection}" does not exist.`);
          return null;
        }
        throw error;
      }
    });
  }

  /**
   * Run health checks on Qdrant
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string; host?: string }> {
    console.log(`[QdrantService] Executing Qdrant cluster health diagnostics...`);
    
    try {
      // Use getCollections as a reliable connection test
      await qdrantClient.getCollections();
      const host = typeof process !== 'undefined' ? process.env.QDRANT_URL || 'http://localhost:6333' : 'http://localhost:6333';
      
      console.log(`[QdrantService] Connection healthy. Host: ${host}`);
      return { status: 'healthy', host };
    } catch (error: any) {
      console.error(`[QdrantService] Connection unhealthy. Error: ${error.message}`);
      return { status: 'unhealthy', error: error.message };
    }
  }
}

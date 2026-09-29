import { QdrantService } from '../../../../services/qdrant.service';
import { EmbeddingService } from '../../../../services/embedding.service';
import { VectorSearchService } from '../../../../services/vector-search.service';

const qdrantService = new QdrantService();
const embeddingService = new EmbeddingService();
const vectorSearchService = new VectorSearchService(qdrantService, embeddingService);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, collections, limit, filter, scoreThreshold } = body;

    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'Missing or invalid required parameter: query' }, { status: 400 });
    }

    console.log(`[API/Vector/SearchAll] POST request received. Query: "${query}"`);
    const results = await vectorSearchService.searchAcrossCollections(query, collections, limit, filter, scoreThreshold);

    return Response.json({ success: true, results });
  } catch (error: any) {
    console.error('[API/Vector/SearchAll] Handler failure:', error);
    return Response.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}

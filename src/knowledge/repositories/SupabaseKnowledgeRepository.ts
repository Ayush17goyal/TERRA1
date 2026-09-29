import type {
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgeRepository,
  RetrievalCandidate,
  RetrievalQuery,
} from '../types';

export interface SupabaseLikeClient {
  rpc(name: string, params?: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
  from(table: string): {
    select(columns?: string): unknown;
    upsert?(values: unknown, options?: unknown): Promise<{ data: unknown; error: unknown }>;
  };
}

interface SupabaseSearchRow {
  id: string;
  kind: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  score?: number;
  vector_score?: number;
  keyword_score?: number;
}

export class SupabaseKnowledgeRepository implements KnowledgeRepository {
  private readonly client: SupabaseLikeClient;
  private readonly tableName: string;
  private readonly vectorRpcName: string;
  private readonly keywordRpcName: string;

  constructor(
    client: SupabaseLikeClient,
    options: { tableName?: string; vectorRpcName?: string; keywordRpcName?: string } = {}
  ) {
    this.client = client;
    this.tableName = options.tableName ?? 'mentor_knowledge_chunks';
    this.vectorRpcName = options.vectorRpcName ?? 'match_mentor_knowledge_chunks';
    this.keywordRpcName = options.keywordRpcName ?? 'search_mentor_knowledge_chunks';
  }

  async searchVector(query: RetrievalQuery, embedding: number[]): Promise<RetrievalCandidate[]> {
    const { data, error } = await this.client.rpc(this.vectorRpcName, {
      query_embedding: embedding,
      match_count: query.limit,
      match_kinds: query.kinds,
      match_filters: query.filters,
    });

    if (error) {
      throw new Error(`Vector retrieval failed: ${this.errorMessage(error)}`);
    }

    return this.rows(data).map((row) => this.toCandidate(row, 'vector'));
  }

  async searchKeyword(query: RetrievalQuery): Promise<RetrievalCandidate[]> {
    const { data, error } = await this.client.rpc(this.keywordRpcName, {
      query_text: query.text,
      match_count: query.limit,
      match_kinds: query.kinds,
      match_filters: query.filters,
    });

    if (error) {
      throw new Error(`Keyword retrieval failed: ${this.errorMessage(error)}`);
    }

    return this.rows(data).map((row) => this.toCandidate(row, 'keyword'));
  }

  async getByIds(ids: string[]): Promise<KnowledgeDocument[]> {
    if (ids.length === 0) {
      return [];
    }

    const { data, error } = await this.client.rpc('get_mentor_knowledge_chunks_by_ids', {
      chunk_ids: ids,
    });

    if (error) {
      throw new Error(`Knowledge lookup failed: ${this.errorMessage(error)}`);
    }

    return this.rows(data).map((row) => this.toDocument(row));
  }

  async upsertChunks(chunks: KnowledgeChunk[]): Promise<void> {
    const payload = chunks.map((chunk) => ({
      id: chunk.id,
      parent_id: chunk.parentId,
      chunk_index: chunk.chunkIndex,
      kind: chunk.kind,
      title: chunk.title,
      content: chunk.content,
      metadata: chunk.metadata,
      embedding: chunk.embedding,
    }));

    const builder = this.client.from(this.tableName);
    if (!builder.upsert) {
      throw new Error('Supabase client does not support upsert for knowledge chunks.');
    }

    const { error } = await builder.upsert(payload, { onConflict: 'id' });
    if (error) {
      throw new Error(`Knowledge chunk upsert failed: ${this.errorMessage(error)}`);
    }
  }

  private rows(data: unknown): SupabaseSearchRow[] {
    return Array.isArray(data) ? data as SupabaseSearchRow[] : [];
  }

  private toCandidate(row: SupabaseSearchRow, source: 'vector' | 'keyword'): RetrievalCandidate {
    const score = Number(row.score ?? row.vector_score ?? row.keyword_score ?? 0);
    return {
      document: this.toDocument(row),
      vectorScore: source === 'vector' ? score : undefined,
      keywordScore: source === 'keyword' ? score : undefined,
      finalScore: score,
      reasons: [source],
    };
  }

  private toDocument(row: SupabaseSearchRow): KnowledgeDocument {
    return {
      id: row.id,
      kind: row.kind as KnowledgeDocument['kind'],
      title: row.title,
      content: row.content,
      metadata: row.metadata ?? {},
    };
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return JSON.stringify(error);
  }
}


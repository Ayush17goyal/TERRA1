export const PGVECTOR_INDEX_SQL = `
create extension if not exists vector;

create table if not exists mentor_knowledge_chunks (
  id text primary key,
  parent_id text not null,
  chunk_index integer not null,
  kind text not null,
  title text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mentor_knowledge_chunks_kind_idx
  on mentor_knowledge_chunks(kind);

create index if not exists mentor_knowledge_chunks_metadata_gin_idx
  on mentor_knowledge_chunks using gin(metadata);

create index if not exists mentor_knowledge_chunks_content_fts_idx
  on mentor_knowledge_chunks using gin(to_tsvector('english', content));

create index if not exists mentor_knowledge_chunks_embedding_hnsw_idx
  on mentor_knowledge_chunks using hnsw (embedding vector_cosine_ops);
`;

export const PGVECTOR_RPC_SQL = `
create or replace function match_mentor_knowledge_chunks(
  query_embedding vector(1536),
  match_count int,
  match_kinds text[],
  match_filters jsonb default '{}'::jsonb
)
returns table (
  id text,
  kind text,
  title text,
  content text,
  metadata jsonb,
  score double precision
)
language sql stable as $$
  select
    id,
    kind,
    title,
    content,
    metadata,
    1 - (embedding <=> query_embedding) as score
  from mentor_knowledge_chunks
  where embedding is not null
    and kind = any(match_kinds)
    and metadata @> match_filters
  order by embedding <=> query_embedding
  limit match_count;
$$;

create or replace function search_mentor_knowledge_chunks(
  query_text text,
  match_count int,
  match_kinds text[],
  match_filters jsonb default '{}'::jsonb
)
returns table (
  id text,
  kind text,
  title text,
  content text,
  metadata jsonb,
  score double precision
)
language sql stable as $$
  select
    id,
    kind,
    title,
    content,
    metadata,
    ts_rank_cd(to_tsvector('english', content), plainto_tsquery('english', query_text)) as score
  from mentor_knowledge_chunks
  where kind = any(match_kinds)
    and metadata @> match_filters
    and to_tsvector('english', content) @@ plainto_tsquery('english', query_text)
  order by score desc
  limit match_count;
$$;
`;

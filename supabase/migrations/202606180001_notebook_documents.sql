-- Migration to support notebook documents indexing storage in Supabase
create table if not exists public.notebook_documents (
  document_id text primary key,
  user_id text not null,
  document_type text,
  title text,
  metadata jsonb not null default '{}'::jsonb,
  chunks jsonb not null default '[]'::jsonb,
  entities jsonb not null default '[]'::jsonb,
  relationships jsonb not null default '[]'::jsonb,
  citations jsonb not null default '[]'::jsonb,
  summary text,
  created_at timestamptz not null default now()
);

create index if not exists idx_notebook_documents_user on public.notebook_documents(user_id);
create index if not exists idx_notebook_documents_type on public.notebook_documents(document_type);

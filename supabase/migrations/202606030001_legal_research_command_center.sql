create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.research_queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  topic text not null,
  research_mode text not null check (research_mode in ('Academic', 'Moot Court', 'Judiciary', 'Lawyer')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed')),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.research_reports (
  id uuid primary key default gen_random_uuid(),
  query_id uuid not null references public.research_queries(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  summary text,
  research_outline jsonb not null default '{"issues":[],"arguments":[],"questions":[]}'::jsonb,
  research_mode text not null check (research_mode in ('Academic', 'Moot Court', 'Judiciary', 'Lawyer')),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.research_sources (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.research_reports(id) on delete cascade,
  source_type text not null check (source_type in ('case', 'act', 'article', 'note')),
  title text not null,
  citation text,
  court text,
  year integer,
  summary text,
  source_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.research_notes (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.research_reports(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  content text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.saved_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  report_id uuid not null references public.research_reports(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  unique (user_id, report_id)
);

create table if not exists public.research_assets (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.research_reports(id) on delete cascade,
  asset_type text not null check (asset_type in ('case_matrix', 'issue_checklist', 'argument_map')),
  asset_data jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_research_queries_user_id on public.research_queries(user_id);
create index if not exists idx_research_queries_created_at on public.research_queries(created_at);
create index if not exists idx_research_reports_user_id on public.research_reports(user_id);
create index if not exists idx_research_reports_query_id on public.research_reports(query_id);
create index if not exists idx_research_reports_created_at on public.research_reports(created_at);
create index if not exists idx_research_sources_report_id on public.research_sources(report_id);
create index if not exists idx_research_sources_created_at on public.research_sources(created_at);
create index if not exists idx_research_notes_user_id on public.research_notes(user_id);
create index if not exists idx_research_notes_report_id on public.research_notes(report_id);
create index if not exists idx_saved_reports_user_id on public.saved_reports(user_id);
create index if not exists idx_research_assets_report_id on public.research_assets(report_id);
create index if not exists idx_research_assets_created_at on public.research_assets(created_at);

alter table public.users enable row level security;
alter table public.research_queries enable row level security;
alter table public.research_reports enable row level security;
alter table public.research_sources enable row level security;
alter table public.research_notes enable row level security;
alter table public.saved_reports enable row level security;
alter table public.research_assets enable row level security;

create policy "users own profile" on public.users
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "users own queries" on public.research_queries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "users own reports" on public.research_reports
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "users own sources" on public.research_sources
  for all using (
    exists (
      select 1 from public.research_reports r
      where r.id = research_sources.report_id and r.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.research_reports r
      where r.id = research_sources.report_id and r.user_id = auth.uid()
    )
  );

create policy "users own notes" on public.research_notes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "users own saved reports" on public.saved_reports
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "users own assets" on public.research_assets
  for all using (
    exists (
      select 1 from public.research_reports r
      where r.id = research_assets.report_id and r.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.research_reports r
      where r.id = research_assets.report_id and r.user_id = auth.uid()
    )
  );

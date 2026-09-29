create table if not exists public.personal_exam_libraries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  status text not null default 'building',
  current_stage text,
  topics_count integer not null default 0,
  subtopics_count integer not null default 0,
  definitions_count integer not null default 0,
  cases_count integer not null default 0,
  illustrations_count integer not null default 0,
  coverage_score double precision not null default 0,
  confidence_score double precision not null default 0,
  review_reasons text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.topic_knowledge_units (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  topic text not null,
  subtopic text not null,
  summary text not null default '',
  definitions jsonb not null default '[]'::jsonb,
  legal_provisions jsonb not null default '[]'::jsonb,
  principles jsonb not null default '[]'::jsonb,
  exceptions jsonb not null default '[]'::jsonb,
  landmark_cases jsonb not null default '[]'::jsonb,
  referenced_cases jsonb not null default '[]'::jsonb,
  illustrations jsonb not null default '[]'::jsonb,
  examples jsonb not null default '[]'::jsonb,
  comparisons jsonb not null default '[]'::jsonb,
  keywords jsonb not null default '[]'::jsonb,
  references jsonb not null default '[]'::jsonb,
  coverage_score double precision not null default 0,
  confidence_score double precision not null default 0,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  last_updated timestamptz not null default now(),
  unique (user_id, topic, subtopic)
);

create table if not exists public.topic_graph_edges (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  source_tku_id uuid not null references public.topic_knowledge_units(id) on delete cascade,
  target_tku_id uuid not null references public.topic_knowledge_units(id) on delete cascade,
  relation text not null,
  strength double precision not null default 0.5,
  references jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_tku_id, target_tku_id, relation)
);

create index if not exists idx_tku_user_topic_subtopic on public.topic_knowledge_units(user_id, topic, subtopic);
create index if not exists idx_tku_user_scores on public.topic_knowledge_units(user_id, coverage_score, confidence_score);
create index if not exists idx_topic_graph_user_source on public.topic_graph_edges(user_id, source_tku_id);
create index if not exists idx_topic_graph_user_target on public.topic_graph_edges(user_id, target_tku_id);

alter table public.personal_exam_libraries enable row level security;
alter table public.topic_knowledge_units enable row level security;
alter table public.topic_graph_edges enable row level security;

create policy "personal_exam_libraries_user_isolation"
on public.personal_exam_libraries
for all
using (user_id = coalesce(auth.jwt() ->> 'sub', current_setting('request.jwt.claim.sub', true)))
with check (user_id = coalesce(auth.jwt() ->> 'sub', current_setting('request.jwt.claim.sub', true)));

create policy "topic_knowledge_units_user_isolation"
on public.topic_knowledge_units
for all
using (user_id = coalesce(auth.jwt() ->> 'sub', current_setting('request.jwt.claim.sub', true)))
with check (user_id = coalesce(auth.jwt() ->> 'sub', current_setting('request.jwt.claim.sub', true)));

create policy "topic_graph_edges_user_isolation"
on public.topic_graph_edges
for all
using (user_id = coalesce(auth.jwt() ->> 'sub', current_setting('request.jwt.claim.sub', true)))
with check (user_id = coalesce(auth.jwt() ->> 'sub', current_setting('request.jwt.claim.sub', true)));

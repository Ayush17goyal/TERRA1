create table if not exists public.model_answer_entries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  question_id uuid not null references public.question_bank_entries(id) on delete cascade,
  tku_id uuid not null references public.topic_knowledge_units(id) on delete cascade,
  question text not null,
  mark_value integer not null,
  components jsonb not null default '[]'::jsonb,
  examiner_keywords jsonb not null default '[]'::jsonb,
  bound_entity_refs jsonb not null default '[]'::jsonb,
  grounding_sources jsonb not null default '[]'::jsonb,
  quality_score double precision not null default 0,
  validation_status text not null,
  validation_reasons text,
  source_question_version integer not null default 1,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, question_id)
);

create index if not exists idx_model_answer_user_status
on public.model_answer_entries(user_id, validation_status);

create index if not exists idx_model_answer_user_tku
on public.model_answer_entries(user_id, tku_id);

alter table public.model_answer_entries enable row level security;

create policy "model_answer_entries_user_isolation"
on public.model_answer_entries
for all
using (user_id = coalesce(auth.jwt() ->> 'sub', current_setting('request.jwt.claim.sub', true)))
with check (user_id = coalesce(auth.jwt() ->> 'sub', current_setting('request.jwt.claim.sub', true)));

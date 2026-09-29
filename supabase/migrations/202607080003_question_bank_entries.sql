create table if not exists public.question_bank_entries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  plan_id uuid not null references public.question_plans(id) on delete cascade,
  slot_id uuid not null references public.question_slots(id) on delete cascade,
  tku_id uuid not null references public.topic_knowledge_units(id) on delete cascade,
  question text not null,
  question_type text not null,
  difficulty text not null,
  topic text not null,
  subtopic text not null,
  mark_value integer not null,
  rubric jsonb not null default '[]'::jsonb,
  bound_entity_refs jsonb not null default '[]'::jsonb,
  grounding_sources jsonb not null default '[]'::jsonb,
  quality_score double precision not null default 0,
  validation_status text not null,
  validation_reasons text,
  source_tku_version integer not null default 1,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slot_id)
);

create index if not exists idx_question_bank_user_topic_type_mark_status
on public.question_bank_entries(user_id, topic, subtopic, question_type, mark_value, validation_status);

create index if not exists idx_question_bank_user_tku
on public.question_bank_entries(user_id, tku_id);

alter table public.question_bank_entries enable row level security;

create policy "question_bank_entries_user_isolation"
on public.question_bank_entries
for all
using (user_id = coalesce(auth.jwt() ->> 'sub', current_setting('request.jwt.claim.sub', true)))
with check (user_id = coalesce(auth.jwt() ->> 'sub', current_setting('request.jwt.claim.sub', true)));

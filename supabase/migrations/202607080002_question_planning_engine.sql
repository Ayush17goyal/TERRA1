create table if not exists public.question_plans (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  status text not null default 'ready',
  coverage_matrix jsonb not null default '[]'::jsonb,
  mark_distribution jsonb not null default '[]'::jsonb,
  type_distribution jsonb not null default '[]'::jsonb,
  question_requirements jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.question_slots (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.question_plans(id) on delete cascade,
  user_id text not null,
  tku_id uuid not null references public.topic_knowledge_units(id) on delete cascade,
  topic text not null,
  subtopic text not null,
  question_type text not null,
  mark_value integer not null,
  slot_index integer not null,
  eligibility_score double precision not null default 0,
  required_entity_refs jsonb not null default '[]'::jsonb,
  requirements jsonb not null default '{}'::jsonb,
  status text not null default 'planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_question_slots_user_tku_type_mark
on public.question_slots(user_id, tku_id, question_type, mark_value);

create index if not exists idx_question_slots_plan
on public.question_slots(plan_id);

alter table public.question_plans enable row level security;
alter table public.question_slots enable row level security;

create policy "question_plans_user_isolation"
on public.question_plans
for all
using (user_id = coalesce(auth.jwt() ->> 'sub', current_setting('request.jwt.claim.sub', true)))
with check (user_id = coalesce(auth.jwt() ->> 'sub', current_setting('request.jwt.claim.sub', true)));

create policy "question_slots_user_isolation"
on public.question_slots
for all
using (user_id = coalesce(auth.jwt() ->> 'sub', current_setting('request.jwt.claim.sub', true)))
with check (user_id = coalesce(auth.jwt() ->> 'sub', current_setting('request.jwt.claim.sub', true)));

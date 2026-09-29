-- Production persistence for the existing 60-lesson Legislative Drafting Academy.
alter table if exists public.drafting_mentor_sessions
  add column if not exists academy_state text not null default '{}',
  add column if not exists state_version integer not null default 0,
  add column if not exists last_activity_at timestamptz;

create unique index if not exists ux_drafting_academy_user
  on public.drafting_mentor_sessions(user_id)
  where topic = '__LEGISLATIVE_DRAFTING_ACADEMY__';
create index if not exists idx_drafting_academy_activity
  on public.drafting_mentor_sessions(user_id, last_activity_at desc);

alter table public.drafting_mentor_sessions enable row level security;
drop policy if exists drafting_mentor_sessions_own_records on public.drafting_mentor_sessions;
create policy drafting_mentor_sessions_own_records on public.drafting_mentor_sessions
  for all using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

create table if not exists public.drafting_academy_versions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  lesson_index integer not null check (lesson_index between 0 and 76),
  version_number integer not null check (version_number > 0),
  answer_text text not null,
  review jsonb not null default '{}'::jsonb,
  score numeric not null default 0 check (score between 0 and 100),
  created_at timestamptz not null default now(),
  unique(user_id, lesson_index, version_number)
);
create index if not exists idx_drafting_versions_user_lesson on public.drafting_academy_versions(user_id, lesson_index, version_number desc);
alter table public.drafting_academy_versions enable row level security;
drop policy if exists drafting_academy_versions_own_records on public.drafting_academy_versions;
create policy drafting_academy_versions_own_records on public.drafting_academy_versions
  for all using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);
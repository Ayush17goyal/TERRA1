-- Migration: AI Exam Prep & Calendar System Database Schema

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  avatar_url text,
  created_at tinmestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, new.id::text || '@legatrixon.local'),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.users.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.users (id, email, full_name, avatar_url)
select
  id,
  coalesce(email, id::text || '@legatrixon.local'),
  coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name'),
  raw_user_meta_data ->> 'avatar_url'
from auth.users
on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.users.full_name),
      avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url),
      updated_at = now();

-- 1. Exams Table
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  subject text not null,
  exam_date timestamp with time zone not null,
  prep_level text not null check (prep_level in ('Beginner', 'Intermediate', 'Expert')),
  syllabus_completion integer not null default 0 check (syllabus_completion >= 0 and syllabus_completion <= 100),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- 2. Roadmaps Table
create table if not exists public.roadmaps (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade unique,
  data jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- 3. Revision Plans Table
create table if not exists public.revision_plans (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade unique,
  data jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- 4. Mock Tests Table
create table if not exists public.mock_tests (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  subject text not null,
  title text not null,
  score integer check (score >= 0 and score <= 100),
  total_questions integer not null default 20,
  date timestamp with time zone not null,
  weak_subjects jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- 5. Calendar Events Table
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  exam_id uuid references public.exams(id) on delete set null,
  title text not null,
  event_date date not null,
  event_time time not null,
  subject text not null,
  event_type text not null check (event_type in ('class', 'assignment', 'moot', 'internship', 'exam', 'study', 'research', 'revision')),
  google_event_id text,
  is_synced boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- 6. Notifications Table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'alert',
  is_read boolean not null default false,
  trigger_time timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now()
);

-- 7. Readiness Snapshots Table
create table if not exists public.readiness_snapshots (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  syllabus_completion integer not null,
  mock_scores_avg numeric not null,
  study_hours_total numeric not null,
  revision_progress integer not null,
  habit_compliance integer not null,
  readiness_score integer not null,
  expected_7_days integer not null,
  expected_14_days integer not null,
  expected_30_days integer not null,
  created_at timestamp with time zone not null default now()
);

-- 8. Google OAuth Tokens Table
create table if not exists public.google_oauth_tokens (
  user_id uuid primary key references public.users(id) on delete cascade,
  google_access_token text not null,
  google_refresh_token text,
  token_expiry timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- 9. Recommendations Table
create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  target_date date not null default current_date,
  created_at timestamp with time zone not null default now()
);

-- Indices
create index if not exists idx_exams_user_id on public.exams(user_id);
create index if not exists idx_roadmaps_exam_id on public.roadmaps(exam_id);
create index if not exists idx_revision_plans_exam_id on public.revision_plans(exam_id);
create index if not exists idx_mock_tests_exam_id on public.mock_tests(exam_id);
create index if not exists idx_calendar_events_user_id on public.calendar_events(user_id);
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_readiness_snapshots_exam_id on public.readiness_snapshots(exam_id);
create index if not exists idx_recommendations_user_id on public.recommendations(user_id);

-- Enable RLS
alter table public.users enable row level security;
alter table public.exams enable row level security;
alter table public.roadmaps enable row level security;
alter table public.revision_plans enable row level security;
alter table public.mock_tests enable row level security;
alter table public.calendar_events enable row level security;
alter table public.notifications enable row level security;
alter table public.readiness_snapshots enable row level security;
alter table public.google_oauth_tokens enable row level security;
alter table public.recommendations enable row level security;

-- Policies
drop policy if exists "users own profile" on public.users;
create policy "users own profile" on public.users
  for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "users own exams" on public.exams;
create policy "users own exams" on public.exams
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "users own roadmaps" on public.roadmaps;
create policy "users own roadmaps" on public.roadmaps
  for all using (
    exists (select 1 from public.exams e where e.id = roadmaps.exam_id and e.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.exams e where e.id = roadmaps.exam_id and e.user_id = auth.uid())
  );

drop policy if exists "users own revision plans" on public.revision_plans;
create policy "users own revision plans" on public.revision_plans
  for all using (
    exists (select 1 from public.exams e where e.id = revision_plans.exam_id and e.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.exams e where e.id = revision_plans.exam_id and e.user_id = auth.uid())
  );

drop policy if exists "users own mock tests" on public.mock_tests;
create policy "users own mock tests" on public.mock_tests
  for all using (
    exists (select 1 from public.exams e where e.id = mock_tests.exam_id and e.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.exams e where e.id = mock_tests.exam_id and e.user_id = auth.uid())
  );

drop policy if exists "users own calendar events" on public.calendar_events;
create policy "users own calendar events" on public.calendar_events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "users own notifications" on public.notifications;
create policy "users own notifications" on public.notifications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "users own readiness snapshots" on public.readiness_snapshots;
create policy "users own readiness snapshots" on public.readiness_snapshots
  for all using (
    exists (select 1 from public.exams e where e.id = readiness_snapshots.exam_id and e.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.exams e where e.id = readiness_snapshots.exam_id and e.user_id = auth.uid())
  );

drop policy if exists "users own google tokens" on public.google_oauth_tokens;
create policy "users own google tokens" on public.google_oauth_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "users own recommendations" on public.recommendations;
create policy "users own recommendations" on public.recommendations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

notify pgrst, 'reload schema';

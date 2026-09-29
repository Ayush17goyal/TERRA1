-- Academic Navigator operating system persistence layer.

alter table public.calendar_events
  add column if not exists description text not null default '',
  add column if not exists end_date date,
  add column if not exists priority text not null default 'Medium'
    check (priority in ('Low', 'Medium', 'High', 'Critical')),
  add column if not exists category text,
  add column if not exists reminder_settings jsonb not null default '{"enabled":true,"minutes_before":1440}'::jsonb;

create table if not exists public.academic_ai_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  calendar_event_id uuid references public.calendar_events(id) on delete cascade,
  title text not null,
  task_type text not null check (task_type in ('study', 'revision', 'daily_target', 'weekly_roadmap', 'priority')),
  target_date date not null,
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High', 'Critical')),
  status text not null default 'pending' check (status in ('pending', 'completed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.academic_habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  log_date date not null,
  study_hours numeric not null default 0 check (study_hours >= 0),
  judgments_read integer not null default 0 check (judgments_read >= 0),
  research_sessions integer not null default 0 check (research_sessions >= 0),
  moot_preparation integer not null default 0 check (moot_preparation >= 0),
  flashcard_revision integer not null default 0 check (flashcard_revision >= 0),
  assignment_completion integer not null default 0 check (assignment_completion >= 0),
  calendar_event_id uuid references public.calendar_events(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique(user_id, log_date)
);

create table if not exists public.internship_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  organization text not null,
  position text not null,
  deadline date not null,
  status text not null default 'Interested'
    check (status in ('Interested', 'Applied', 'Assessment', 'Interview', 'Selected', 'Rejected')),
  notes text not null default '',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.academic_analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  snapshot_date date not null default current_date,
  productivity_score integer not null check (productivity_score >= 0 and productivity_score <= 100),
  consistency_score integer not null check (consistency_score >= 0 and consistency_score <= 100),
  study_hours numeric not null default 0,
  revision_completion integer not null check (revision_completion >= 0 and revision_completion <= 100),
  goal_achievement integer not null check (goal_achievement >= 0 and goal_achievement <= 100),
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_academic_ai_tasks_user_id on public.academic_ai_tasks(user_id);
create index if not exists idx_academic_ai_tasks_event_id on public.academic_ai_tasks(calendar_event_id);
create index if not exists idx_academic_habit_logs_user_date on public.academic_habit_logs(user_id, log_date);
create index if not exists idx_internship_applications_user_id on public.internship_applications(user_id);
create index if not exists idx_academic_analytics_user_date on public.academic_analytics_snapshots(user_id, snapshot_date);

alter table public.academic_ai_tasks enable row level security;
alter table public.academic_habit_logs enable row level security;
alter table public.internship_applications enable row level security;
alter table public.academic_analytics_snapshots enable row level security;

drop policy if exists "users own academic ai tasks" on public.academic_ai_tasks;
create policy "users own academic ai tasks" on public.academic_ai_tasks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "users own academic habit logs" on public.academic_habit_logs;
create policy "users own academic habit logs" on public.academic_habit_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "users own internship applications" on public.internship_applications;
create policy "users own internship applications" on public.internship_applications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "users own academic analytics snapshots" on public.academic_analytics_snapshots;
create policy "users own academic analytics snapshots" on public.academic_analytics_snapshots
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

notify pgrst, 'reload schema';



-- Align Academic Navigator tables with the existing Clerk + Supabase direct-sync pattern.
-- The frontend stores the resolved public.users.id while auth.uid() is not available.

alter table public.exams
  add column if not exists university text not null default '',
  add column if not exists available_hours_per_day numeric not null default 3
    check (available_hours_per_day >= 0),
  add column if not exists difficulty_level text not null default 'Medium'
    check (difficulty_level in ('Easy', 'Medium', 'Hard')),
  add column if not exists credits_weightage integer not null default 4
    check (credits_weightage >= 0),
  add column if not exists email_reminder_enabled boolean not null default false,
  add column if not exists email_reminder_minutes integer not null default 1440
    check (email_reminder_minutes >= 0);

create table if not exists public.user_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  module text not null,
  action text not null,
  module_name text,
  action_type text,
  session_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

alter table public.user_activity_logs
  add column if not exists module text,
  add column if not exists action text,
  add column if not exists module_name text,
  add column if not exists action_type text,
  add column if not exists session_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamp with time zone not null default now();

update public.user_activity_logs
set
  module = coalesce(module, module_name, 'Unknown'),
  action = coalesce(action, action_type, 'Unknown'),
  module_name = coalesce(module_name, module),
  action_type = coalesce(action_type, action);

alter table public.user_activity_logs
  alter column module set not null,
  alter column action set not null;

create index if not exists idx_user_activity_logs_user_created
  on public.user_activity_logs(user_id, created_at desc);
create index if not exists idx_user_activity_logs_module_action
  on public.user_activity_logs(module_name, action_type);

create table if not exists public.exam_topics (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  status text not null default 'Not Started'
    check (status in ('Not Started', 'In Progress', 'Completed', 'Needs Revision')),
  difficulty text not null default 'Medium'
    check (difficulty in ('Easy', 'Medium', 'Hard')),
  quiz_score integer not null default 0
    check (quiz_score >= 0 and quiz_score <= 100),
  flashcard_score integer not null default 0
    check (flashcard_score >= 0 and flashcard_score <= 100),
  mastery_score integer not null default 0
    check (mastery_score >= 0 and mastery_score <= 100),
  pyq_frequency integer not null default 1
    check (pyq_frequency >= 0),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_exam_topics_exam_id on public.exam_topics(exam_id);
create index if not exists idx_exam_topics_user_id on public.exam_topics(user_id);

create table if not exists public.exam_mock_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  paper_type text not null
    check (paper_type in ('University Style Paper', 'PYQ Style Paper', 'MCQ Test', 'Case Based Questions', 'Short Notes', 'Long Questions')),
  title text not null,
  attempt_score integer check (attempt_score >= 0 and attempt_score <= 100),
  time_taken_minutes integer check (time_taken_minutes >= 0),
  accuracy integer check (accuracy >= 0 and accuracy <= 100),
  scheduled_date date not null,
  questions jsonb not null default '[]'::jsonb,
  responses jsonb not null default '{}'::jsonb,
  evaluation jsonb not null default '{}'::jsonb,
  instructions jsonb not null default '[]'::jsonb,
  max_marks integer not null default 0 check (max_marks >= 0),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'submitted')),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.exam_mock_attempts
  add column if not exists questions jsonb not null default '[]'::jsonb,
  add column if not exists responses jsonb not null default '{}'::jsonb,
  add column if not exists evaluation jsonb not null default '{}'::jsonb,
  add column if not exists instructions jsonb not null default '[]'::jsonb,
  add column if not exists max_marks integer not null default 0,
  add column if not exists status text not null default 'scheduled';

create table if not exists public.exam_forge_assets (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  topic_id uuid references public.exam_topics(id) on delete set null,
  asset_type text not null
    check (asset_type in ('Notes', 'Flashcards', 'MCQs', 'Revision Sheet', 'One Page Summary')),
  title text not null,
  content jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_exam_mock_attempts_exam_id on public.exam_mock_attempts(exam_id);
create index if not exists idx_exam_mock_attempts_user_id on public.exam_mock_attempts(user_id);
create index if not exists idx_exam_forge_assets_exam_id on public.exam_forge_assets(exam_id);
create index if not exists idx_exam_forge_assets_user_id on public.exam_forge_assets(user_id);

update public.internship_applications
set status = case status
  when 'Saved' then 'Interested'
  when 'Interview Scheduled' then 'Interview'
  when 'Offer Received' then 'Selected'
  else status
end
where status in ('Saved', 'Interview Scheduled', 'Offer Received');

alter table public.internship_applications
  alter column status set default 'Interested';

alter table public.internship_applications
  drop constraint if exists internship_applications_status_check,
  add constraint internship_applications_status_check
    check (status in ('Interested', 'Applied', 'Assessment', 'Interview', 'Selected', 'Rejected'));
alter table public.academic_ai_tasks enable row level security;
alter table public.academic_habit_logs enable row level security;
alter table public.internship_applications enable row level security;
alter table public.academic_analytics_snapshots enable row level security;
alter table public.exams enable row level security;
alter table public.user_activity_logs enable row level security;
alter table public.exam_mock_attempts enable row level security;
alter table public.exam_forge_assets enable row level security;

drop policy if exists "Enable all actions for all users" on public.academic_ai_tasks;
drop policy if exists "users own academic ai tasks" on public.academic_ai_tasks;
create policy "users own academic ai tasks" on public.academic_ai_tasks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Enable all actions for all users" on public.academic_habit_logs;
drop policy if exists "users own academic habit logs" on public.academic_habit_logs;
create policy "users own academic habit logs" on public.academic_habit_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Enable all actions for all users" on public.internship_applications;
drop policy if exists "users own internship applications" on public.internship_applications;
create policy "users own internship applications" on public.internship_applications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Enable all actions for all users" on public.academic_analytics_snapshots;
drop policy if exists "users own academic analytics snapshots" on public.academic_analytics_snapshots;
create policy "users own academic analytics snapshots" on public.academic_analytics_snapshots
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Enable all actions for all users" on public.exams;
drop policy if exists "users own exams" on public.exams;
create policy "users own exams" on public.exams
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Enable all actions for all users" on public.user_activity_logs;
drop policy if exists "users own activity logs" on public.user_activity_logs;
create policy "users own activity logs" on public.user_activity_logs
  for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);

drop policy if exists "Enable all actions for all users" on public.exam_mock_attempts;
drop policy if exists "users own exam mock attempts" on public.exam_mock_attempts;
create policy "users own exam mock attempts" on public.exam_mock_attempts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Enable all actions for all users" on public.exam_forge_assets;
drop policy if exists "users own exam forge assets" on public.exam_forge_assets;
create policy "users own exam forge assets" on public.exam_forge_assets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

DO $$
BEGIN
  ALTER TABLE public.exam_topics ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Enable all actions for all users" ON public.exam_topics;
  DROP POLICY IF EXISTS "users own exam topics" ON public.exam_topics;
  CREATE POLICY "users own exam topics" ON public.exam_topics
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'exam_mock_attempts') THEN
    ALTER TABLE public.exam_mock_attempts ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Enable all actions for all users" ON public.exam_mock_attempts;
    DROP POLICY IF EXISTS "users own exam mock attempts" ON public.exam_mock_attempts;
    CREATE POLICY "users own exam mock attempts" ON public.exam_mock_attempts
      FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'exam_forge_assets') THEN
    ALTER TABLE public.exam_forge_assets ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Enable all actions for all users" ON public.exam_forge_assets;
    DROP POLICY IF EXISTS "users own exam forge assets" ON public.exam_forge_assets;
    CREATE POLICY "users own exam forge assets" ON public.exam_forge_assets
      FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'readiness_snapshots') THEN
    ALTER TABLE public.readiness_snapshots ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Enable all actions for all users" ON public.readiness_snapshots;
    DROP POLICY IF EXISTS "users own readiness snapshots" ON public.readiness_snapshots;
    CREATE POLICY "users own readiness snapshots" ON public.readiness_snapshots
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.exams e WHERE e.id = readiness_snapshots.exam_id AND e.user_id = auth.uid())
      ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.exams e WHERE e.id = readiness_snapshots.exam_id AND e.user_id = auth.uid())
      );
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'recommendations') THEN
    ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Enable all actions for all users" ON public.recommendations;
    DROP POLICY IF EXISTS "users own recommendations" ON public.recommendations;
    CREATE POLICY "users own recommendations" ON public.recommendations
      FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'roadmaps') THEN
    ALTER TABLE public.roadmaps ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Enable all actions for all users" ON public.roadmaps;
    DROP POLICY IF EXISTS "users own roadmaps" ON public.roadmaps;
    CREATE POLICY "users own roadmaps" ON public.roadmaps
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.exams e WHERE e.id = roadmaps.exam_id AND e.user_id = auth.uid())
      ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.exams e WHERE e.id = roadmaps.exam_id AND e.user_id = auth.uid())
      );
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'revision_plans') THEN
    ALTER TABLE public.revision_plans ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Enable all actions for all users" ON public.revision_plans;
    DROP POLICY IF EXISTS "users own revision plans" ON public.revision_plans;
    CREATE POLICY "users own revision plans" ON public.revision_plans
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.exams e WHERE e.id = revision_plans.exam_id AND e.user_id = auth.uid())
      ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.exams e WHERE e.id = revision_plans.exam_id AND e.user_id = auth.uid())
      );
  END IF;
END $$;
notify pgrst, 'reload schema';





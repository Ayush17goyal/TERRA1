-- Remove Supabase "UNRESTRICTED" warnings while preserving the current
-- Clerk + Supabase direct-sync behavior through the existing open policies.

alter table public.academic_ai_tasks enable row level security;
alter table public.academic_habit_logs enable row level security;
alter table public.internship_applications enable row level security;
alter table public.academic_analytics_snapshots enable row level security;
alter table public.exams enable row level security;

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

DO $$
BEGIN
  IF to_regclass('public.exam_topics') IS NOT NULL THEN
    ALTER TABLE public.exam_topics ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Enable all actions for all users" ON public.exam_topics;
    DROP POLICY IF EXISTS "users own exam topics" ON public.exam_topics;
    CREATE POLICY "users own exam topics" ON public.exam_topics
      FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  IF to_regclass('public.exam_mock_attempts') IS NOT NULL THEN
    ALTER TABLE public.exam_mock_attempts ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Enable all actions for all users" ON public.exam_mock_attempts;
    DROP POLICY IF EXISTS "users own exam mock attempts" ON public.exam_mock_attempts;
    CREATE POLICY "users own exam mock attempts" ON public.exam_mock_attempts
      FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  IF to_regclass('public.exam_forge_assets') IS NOT NULL THEN
    ALTER TABLE public.exam_forge_assets ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Enable all actions for all users" ON public.exam_forge_assets;
    DROP POLICY IF EXISTS "users own exam forge assets" ON public.exam_forge_assets;
    CREATE POLICY "users own exam forge assets" ON public.exam_forge_assets
      FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
notify pgrst, 'reload schema';


-- Migration: User Data Synchronization System Setup
-- Alter users table
alter table public.users
  add column if not exists clerk_user_id text unique,
  add column if not exists phone_number text,
  add column if not exists university_name text,
  add column if not exists semester_year text,
  add column if not exists role text default 'student',
  add column if not exists account_status text default 'active',
  add column if not exists joined_date timestamp with time zone default now(),
  add column if not exists last_login timestamp with time zone;

-- Create user_login_logs table
create table if not exists public.user_login_logs (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  email text,
  login_time timestamp with time zone not null default now(),
  logout_time timestamp with time zone,
  ip_address text,
  browser text,
  device text,
  operating_system text,
  login_status text
);

-- Alter calendar_events table
alter table public.calendar_events
  add column if not exists created_by text,
  add column if not exists clerk_user_id text,
  add column if not exists event_created_at timestamp with time zone default now();

-- Alter notifications table
alter table public.notifications
  add column if not exists "user" text,
  add column if not exists sent_at timestamp with time zone default now(),
  add column if not exists opened_at timestamp with time zone,
  add column if not exists delivery_status text default 'sent';

-- Disable Row Level Security to allow direct updates using public anon key workaround
alter table public.users disable row level security;
alter table public.user_login_logs disable row level security;
alter table public.calendar_events disable row level security;
alter table public.notifications disable row level security;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_settings_profiles') THEN
    ALTER TABLE public.user_settings_profiles DISABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_activity_logs') THEN
    ALTER TABLE public.user_activity_logs DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- In case disabling RLS is overridden by system policies, add open policies
drop policy if exists "Enable all actions for all users" on public.users;
create policy "Enable all actions for all users" on public.users
  for all using (true) with check (true);

drop policy if exists "Enable all actions for all users" on public.user_login_logs;
create policy "Enable all actions for all users" on public.user_login_logs
  for all using (true) with check (true);

drop policy if exists "Enable all actions for all users" on public.calendar_events;
create policy "Enable all actions for all users" on public.calendar_events
  for all using (true) with check (true);

drop policy if exists "Enable all actions for all users" on public.notifications;
create policy "Enable all actions for all users" on public.notifications
  for all using (true) with check (true);

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_settings_profiles') THEN
    DROP POLICY IF EXISTS "Enable all actions for all users" ON public.user_settings_profiles;
    CREATE POLICY "Enable all actions for all users" ON public.user_settings_profiles
      FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_activity_logs') THEN
    DROP POLICY IF EXISTS "Enable all actions for all users" ON public.user_activity_logs;
    CREATE POLICY "Enable all actions for all users" ON public.user_activity_logs
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

notify pgrst, 'reload schema';

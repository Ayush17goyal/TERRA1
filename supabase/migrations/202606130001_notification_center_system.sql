-- Migration: Notification Center System Setup & Preference Columns Sync

-- 1. Create or alter user_notification_preferences table
create table if not exists public.user_notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  email_notifications boolean not null default false,
  study_reminders boolean not null default false,
  quiz_reminders boolean not null default false,
  revision_alerts boolean not null default false,
  weekly_reports boolean not null default false,
  browser_push boolean not null default true,
  mobile_push boolean not null default false,
  weekly_digest boolean not null default false,
  quiet_hours_start text not null default '22:00',
  quiet_hours_end text not null default '07:00',
  notification_priority text not null default 'All Notifications',
  updated_at timestamp with time zone not null default now()
);

-- Alter table to ensure all columns exist (in case table was partially created in a prior step)
alter table public.user_notification_preferences 
  add column if not exists email_notifications boolean not null default false,
  add column if not exists study_reminders boolean not null default false,
  add column if not exists quiz_reminders boolean not null default false,
  add column if not exists revision_alerts boolean not null default false,
  add column if not exists weekly_reports boolean not null default false,
  add column if not exists browser_push boolean not null default true,
  add column if not exists mobile_push boolean not null default false,
  add column if not exists weekly_digest boolean not null default false,
  add column if not exists quiet_hours_start text not null default '22:00',
  add column if not exists quiet_hours_end text not null default '07:00',
  add column if not exists notification_priority text not null default 'All Notifications',
  add column if not exists updated_at timestamp with time zone not null default now(),
  add column if not exists fcm_token text;

-- Enable RLS
alter table public.user_notification_preferences enable row level security;

-- Policies
drop policy if exists "users own notification preferences" on public.user_notification_preferences;
create policy "users own notification preferences" on public.user_notification_preferences
  for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);

-- 2. Create or alter notification_logs table
create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  notification_type text not null,
  delivery_method text not null, -- 'email', 'browser', 'mobile'
  title text not null,
  message text not null,
  status text not null, -- 'delivered', 'failed', 'delayed_quiet_hours', 'suppressed_priority'
  sent_at timestamp with time zone not null default now(),
  opened_at timestamp with time zone
);

-- Alter columns (incase they were altered)
alter table public.notification_logs
  add column if not exists notification_type text not null default 'alert',
  add column if not exists delivery_method text not null default 'all',
  add column if not exists opened_at timestamp with time zone;

-- Enable RLS
alter table public.notification_logs enable row level security;

-- Policies
drop policy if exists "users own notification logs" on public.notification_logs;
create policy "users own notification logs" on public.notification_logs
  for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);

-- 3. Enhance notifications table
alter table public.notifications
  add column if not exists type text not null default 'alert',
  add column if not exists opened_at timestamp with time zone;

-- Refresh PostgREST schema cache
notify pgrst, 'reload schema';

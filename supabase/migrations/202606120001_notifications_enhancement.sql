-- Migration: Notifications Enhancement & Push/Email Routing Setup

-- 1. Update user notification preferences table
alter table public.user_notification_preferences 
  add column if not exists delivery_email boolean not null default true,
  add column if not exists delivery_browser boolean not null default true,
  add column if not exists delivery_mobile boolean not null default false,
  add column if not exists delivery_digest boolean not null default false,
  add column if not exists quiet_start text not null default '22:00',
  add column if not exists quiet_end text not null default '07:00',
  add column if not exists priority text not null default 'All Notifications',
  add column if not exists fcm_token text;

-- 2. Update notifications table
alter table public.notifications
  add column if not exists email_sent boolean not null default false,
  add column if not exists delivery_channel text not null default 'all',
  add column if not exists priority text not null default 'normal';

-- 3. Create notification delivery logs table
create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  notification_id uuid references public.notifications(id) on delete set null,
  title text not null,
  message text not null,
  channel text not null, -- 'email', 'browser', 'mobile'
  status text not null, -- 'delivered', 'failed', 'delayed_quiet_hours', 'suppressed_priority'
  error_message text,
  sent_at timestamp with time zone not null default now()
);

-- Indices for logs
create index if not exists idx_notification_logs_user_id on public.notification_logs(user_id);
create index if not exists idx_notification_logs_status on public.notification_logs(status);

-- Enable RLS for logs
alter table public.notification_logs enable row level security;

-- Policies for logs
drop policy if exists "users own notification logs" on public.notification_logs;
create policy "users own notification logs" on public.notification_logs
  for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);

notify pgrst, 'reload schema';

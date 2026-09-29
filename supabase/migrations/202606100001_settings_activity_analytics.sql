create table if not exists public.user_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  module text not null,
  action text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  email text,
  full_name text,
  profile_photo_url text,
  university text,
  year_of_study text,
  learning_goal text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  plan_name text not null,
  status text not null default 'inactive',
  renewal_date timestamptz,
  ai_credits_used integer not null default 0,
  ai_credits_limit integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  email_notifications boolean not null default false,
  study_reminders boolean not null default false,
  quiz_reminders boolean not null default false,
  revision_alerts boolean not null default false,
  weekly_reports boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  badge_key text not null,
  title text not null,
  description text not null,
  unlocked_at timestamptz not null default now(),
  unique(user_id, badge_key)
);

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  status text not null default 'requested' check (status in ('requested', 'soft_deleted', 'permanent_delete_pending', 'completed')),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_activity_logs_user_created on public.user_activity_logs(user_id, created_at desc);
create index if not exists idx_user_activity_logs_module_action on public.user_activity_logs(module, action);
create index if not exists idx_user_achievements_user_id on public.user_achievements(user_id);
create index if not exists idx_account_deletion_requests_user_id on public.account_deletion_requests(user_id);

alter table public.user_activity_logs enable row level security;
alter table public.user_settings_profiles enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.user_notification_preferences enable row level security;
alter table public.user_achievements enable row level security;
alter table public.account_deletion_requests enable row level security;

drop policy if exists "users own activity logs" on public.user_activity_logs;
create policy "users own activity logs" on public.user_activity_logs
  for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);

drop policy if exists "users own settings profile" on public.user_settings_profiles;
create policy "users own settings profile" on public.user_settings_profiles
  for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);

drop policy if exists "users own subscriptions" on public.user_subscriptions;
create policy "users own subscriptions" on public.user_subscriptions
  for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);

drop policy if exists "users own notification preferences" on public.user_notification_preferences;
create policy "users own notification preferences" on public.user_notification_preferences
  for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);

drop policy if exists "users own achievements" on public.user_achievements;
create policy "users own achievements" on public.user_achievements
  for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);

drop policy if exists "users own deletion requests" on public.account_deletion_requests;
create policy "users own deletion requests" on public.account_deletion_requests
  for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);

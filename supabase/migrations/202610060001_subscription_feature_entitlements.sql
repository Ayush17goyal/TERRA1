-- Four-plan subscription catalogue usage enforcement.
create table if not exists public.feature_usage_counters (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  feature_key text not null,
  plan_key text not null,
  period_key text not null,
  used_count integer not null default 0 check (used_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, feature_key, period_key)
);

create index if not exists idx_feature_usage_user_feature
  on public.feature_usage_counters (user_id, feature_key);

create table if not exists public.demo_mode_settings (
  id text primary key,
  enabled boolean not null default true,
  limit_per_feature_per_day integer not null default 4 check (limit_per_feature_per_day between 1 and 100),
  timezone text not null default 'Asia/Kolkata',
  updated_by text,
  updated_at timestamptz not null default now()
);

insert into public.demo_mode_settings (id, enabled, limit_per_feature_per_day, timezone, updated_by)
values ('global', true, 4, 'Asia/Kolkata', 'deployment-migration')
on conflict (id) do nothing;

create table if not exists public.demo_mode_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id text not null,
  action text not null,
  old_value text not null,
  new_value text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.api_usage_errors (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  feature_key text not null,
  error_code text,
  http_status integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_demo_usage_period on public.feature_usage_counters (period_key, feature_key);
create index if not exists idx_api_usage_errors_created_at on public.api_usage_errors (created_at);

alter table public.feature_usage_counters enable row level security;
alter table public.demo_mode_settings enable row level security;
alter table public.demo_mode_audit_logs enable row level security;
alter table public.api_usage_errors enable row level security;

drop policy if exists "users can read own feature usage" on public.feature_usage_counters;
create policy "users can read own feature usage"
on public.feature_usage_counters for select
using (auth.uid()::text = user_id);

-- Backend writes use the server/service role. No direct client mutation policy is
-- intentionally provided, preventing browser-side bypasses of usage limits.
drop policy if exists "authenticated users can read demo mode" on public.demo_mode_settings;
create policy "authenticated users can read demo mode"
on public.demo_mode_settings for select to authenticated using (true);

-- Audit logs and provider error rows intentionally have no browser policies.
notify pgrst, 'reload schema';

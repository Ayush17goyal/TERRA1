create table if not exists public.ai_providers (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique check (provider_key in ('groq', 'gemini', 'openai', 'deepseek', 'openrouter')),
  display_name text not null,
  enabled boolean not null default true,
  priority integer not null default 100,
  status text not null default 'healthy',
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_provider_keys (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null references public.ai_providers(provider_key) on delete cascade,
  label text not null,
  encrypted_key text not null,
  encryption_iv text not null,
  encryption_tag text not null,
  fingerprint text,
  status text not null default 'backup',
  priority integer not null default 100,
  is_active boolean not null default false,
  last_tested_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_failure_reason text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_provider_failures (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null,
  key_fingerprint text,
  http_status integer,
  failure_type text not null,
  safe_message text not null,
  request_module text,
  model text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_provider_alerts (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null,
  severity text not null default 'warning',
  alert_type text not null,
  title text not null,
  message text not null,
  status text not null default 'open',
  email_sent boolean not null default false,
  email_sent_at timestamptz,
  acknowledged_by text,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_provider_usage_metrics (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null,
  key_fingerprint text,
  module_key text,
  request_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  rate_limit_count integer not null default 0,
  quota_failure_count integer not null default 0,
  avg_latency_ms integer not null default 0,
  tokens_prompt integer not null default 0,
  tokens_completion integer not null default 0,
  estimated_cost numeric not null default 0,
  window_start timestamptz,
  window_end timestamptz,
  created_at timestamptz not null default now()
);

insert into public.ai_providers (provider_key, display_name, priority, enabled, status)
values
  ('gemini', 'Gemini', 10, true, 'healthy'),
  ('openai', 'OpenAI', 20, true, 'healthy'),
  ('groq', 'Groq', 30, true, 'healthy'),
  ('deepseek', 'DeepSeek', 40, true, 'healthy'),
  ('openrouter', 'OpenRouter', 50, true, 'healthy')
on conflict (provider_key) do update
set display_name = excluded.display_name,
    priority = excluded.priority,
    updated_at = now();

alter table public.ai_providers enable row level security;
alter table public.ai_provider_keys enable row level security;
alter table public.ai_provider_failures enable row level security;
alter table public.ai_provider_alerts enable row level security;
alter table public.ai_provider_usage_metrics enable row level security;

drop policy if exists "authenticated can read provider health" on public.ai_providers;
create policy "authenticated can read provider health"
on public.ai_providers
for select
using (auth.role() = 'authenticated');

drop policy if exists "authenticated can read provider key metadata" on public.ai_provider_keys;
create policy "authenticated can read provider key metadata"
on public.ai_provider_keys
for select
using (auth.role() = 'authenticated');

drop policy if exists "authenticated can read provider failures" on public.ai_provider_failures;
create policy "authenticated can read provider failures"
on public.ai_provider_failures
for select
using (auth.role() = 'authenticated');

drop policy if exists "authenticated can read provider alerts" on public.ai_provider_alerts;
create policy "authenticated can read provider alerts"
on public.ai_provider_alerts
for select
using (auth.role() = 'authenticated');

drop policy if exists "authenticated can read provider usage metrics" on public.ai_provider_usage_metrics;
create policy "authenticated can read provider usage metrics"
on public.ai_provider_usage_metrics
for select
using (auth.role() = 'authenticated');

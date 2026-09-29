create table if not exists public.user_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  provider text not null check (provider in ('openai', 'gemini', 'groq')),
  api_key_encrypted text not null,
  encryption_iv text not null,
  encryption_tag text not null,
  key_fingerprint text,
  status text not null default 'Connected' check (status in ('Connected', 'Invalid Key', 'Rate Limited', 'Not Configured')),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.user_api_keys
  add column if not exists key_fingerprint text;

alter table public.user_api_keys
  add column if not exists status text not null default 'Connected';

alter table public.user_api_keys
  add column if not exists last_verified_at timestamptz;

create table if not exists public.user_byok_usage_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  requests_user_keys integer not null default 0,
  requests_legatrixon_keys integer not null default 0,
  cache_hits integer not null default 0,
  estimated_api_calls_saved integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_api_keys enable row level security;
alter table public.user_byok_usage_metrics enable row level security;

drop policy if exists "users can read own byok key metadata" on public.user_api_keys;
create policy "users can read own byok key metadata"
on public.user_api_keys
for select
using (auth.uid()::text = user_id);

drop policy if exists "users can insert own byok keys" on public.user_api_keys;
create policy "users can insert own byok keys"
on public.user_api_keys
for insert
with check (auth.uid()::text = user_id);

drop policy if exists "users can update own byok keys" on public.user_api_keys;
create policy "users can update own byok keys"
on public.user_api_keys
for update
using (auth.uid()::text = user_id)
with check (auth.uid()::text = user_id);

drop policy if exists "users can delete own byok keys" on public.user_api_keys;
create policy "users can delete own byok keys"
on public.user_api_keys
for delete
using (auth.uid()::text = user_id);

drop policy if exists "users can read own byok usage metrics" on public.user_byok_usage_metrics;
create policy "users can read own byok usage metrics"
on public.user_byok_usage_metrics
for select
using (auth.uid()::text = user_id);

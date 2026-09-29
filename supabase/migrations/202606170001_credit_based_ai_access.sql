create table if not exists public.ai_plan_entitlements (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null,
  module_key text not null,
  credit_limit integer not null default 0 check (credit_limit >= 0),
  reset_period text not null default 'lifetime',
  is_unlimited boolean not null default false,
  fair_usage_limit integer not null default 0 check (fair_usage_limit >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_key, module_key)
);

create table if not exists public.user_ai_credit_balances (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  module_key text not null,
  plan_key text not null default 'free',
  credits_granted integer not null default 0 check (credits_granted >= 0),
  credits_used integer not null default 0 check (credits_used >= 0),
  credits_remaining integer not null default 0 check (credits_remaining >= 0),
  reset_period text not null default 'lifetime',
  reset_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, module_key)
);

create table if not exists public.ai_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  module_key text not null,
  request_id text,
  transaction_type text not null check (transaction_type in ('grant', 'consume', 'refund', 'admin_adjustment', 'limit_reached')),
  amount integer not null default 0,
  source text not null default 'free_plan',
  provider_used text,
  cache_status text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

insert into public.ai_plan_entitlements (plan_key, module_key, credit_limit, reset_period, is_unlimited, fair_usage_limit)
values
  ('free', 'lexmentor', 100, 'lifetime', false, 0),
  ('free', 'legal_research', 25, 'lifetime', false, 0),
  ('free', 'memorial_architect', 10, 'lifetime', false, 0),
  ('free', 'judgment_mastery', 20, 'lifetime', false, 0),
  ('free', 'lexnotebook', 50, 'lifetime', false, 0),
  ('free', 'smart_study_forge', 50, 'lifetime', false, 0),
  ('free', 'bench_simulator', 20, 'lifetime', false, 0),
  ('student', 'lexmentor', 500, 'monthly', false, 0),
  ('student', 'legal_research', 100, 'monthly', false, 0),
  ('student', 'memorial_architect', 50, 'monthly', false, 0),
  ('student', 'judgment_mastery', 100, 'monthly', false, 0),
  ('student', 'lexnotebook', 250, 'monthly', false, 0),
  ('student', 'smart_study_forge', 250, 'monthly', false, 0),
  ('student', 'bench_simulator', 100, 'monthly', false, 0),
  ('pro', 'lexmentor', 0, 'monthly', true, 5000),
  ('pro', 'legal_research', 0, 'monthly', true, 1000),
  ('pro', 'memorial_architect', 0, 'monthly', true, 500),
  ('pro', 'judgment_mastery', 0, 'monthly', true, 1000),
  ('pro', 'lexnotebook', 0, 'monthly', true, 2500),
  ('pro', 'smart_study_forge', 0, 'monthly', true, 2500),
  ('pro', 'bench_simulator', 0, 'monthly', true, 1000)
on conflict (plan_key, module_key) do update
set credit_limit = excluded.credit_limit,
    reset_period = excluded.reset_period,
    is_unlimited = excluded.is_unlimited,
    fair_usage_limit = excluded.fair_usage_limit,
    updated_at = now();

alter table public.ai_plan_entitlements enable row level security;
alter table public.user_ai_credit_balances enable row level security;
alter table public.ai_credit_transactions enable row level security;

drop policy if exists "users can read own credit balances" on public.user_ai_credit_balances;
create policy "users can read own credit balances"
on public.user_ai_credit_balances
for select
using (auth.uid()::text = user_id);

drop policy if exists "users can read own credit transactions" on public.ai_credit_transactions;
create policy "users can read own credit transactions"
on public.ai_credit_transactions
for select
using (auth.uid()::text = user_id);

drop policy if exists "authenticated users can read plan entitlements" on public.ai_plan_entitlements;
create policy "authenticated users can read plan entitlements"
on public.ai_plan_entitlements
for select
using (auth.role() = 'authenticated');

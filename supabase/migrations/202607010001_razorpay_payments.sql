-- Migration: Razorpay Payments & Subscriptions Tables Setup
-- Create payments table
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id text not null, -- clerk_user_id
  order_id text not null,
  payment_id text,
  plan_id text not null,
  amount numeric not null,
  currency text not null default 'INR',
  status text not null default 'created',
  method text,
  invoice_number text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Create subscriptions table
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique, -- clerk_user_id (one active subscription tracking per user)
  plan text not null,
  status text not null,
  start_date timestamp with time zone not null default now(),
  expiry_date timestamp with time zone,
  payment_id text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Indexes for performance
create index if not exists idx_payments_user_id on public.payments(user_id);
create index if not exists idx_payments_order_id on public.payments(order_id);
create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);

-- Disable Row Level Security (matching project patterns for NestJS/direct sync controller)
alter table public.payments disable row level security;
alter table public.subscriptions disable row level security;

-- Backup open policies in case RLS is somehow enabled
drop policy if exists "Enable all actions for all users" on public.payments;
create policy "Enable all actions for all users" on public.payments
  for all using (true) with check (true);

drop policy if exists "Enable all actions for all users" on public.subscriptions;
create policy "Enable all actions for all users" on public.subscriptions
  for all using (true) with check (true);

notify pgrst, 'reload schema';

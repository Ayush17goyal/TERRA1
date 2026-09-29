-- Migration: User Profiles System Setup

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique not null,
  full_name text,
  phone_number text,
  university_name text,
  semester_year text,
  email text,
  profile_image text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Index for speedy queries
create index if not exists idx_user_profiles_clerk_id on public.user_profiles(clerk_user_id);

-- Enable Row Level Security (RLS)
alter table public.user_profiles enable row level security;

-- Policies for user profiles (open public read/write since NestJS acts as authorization controller)
drop policy if exists "Enable all actions for all users" on public.user_profiles;
create policy "Enable all actions for all users" on public.user_profiles
  for all using (true) with check (true);

notify pgrst, 'reload schema';

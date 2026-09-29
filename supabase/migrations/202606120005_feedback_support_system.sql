-- Migration: Feedback & Support System Tables
create table if not exists public.feedback_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_email text,
  user_name text,
  rating integer not null,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_email text,
  user_name text,
  feedback_type text not null check (feedback_type in ('Helpful', 'Not Helpful')),
  created_at timestamp with time zone not null default now()
);

create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_email text,
  user_name text,
  issue_type text,
  module_name text,
  description text,
  screenshot_url text,
  status text not null default 'Open',
  created_at timestamp with time zone not null default now()
);

create table if not exists public.feature_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_email text,
  user_name text,
  title text not null,
  description text,
  priority text,
  votes integer not null default 0,
  status text not null default 'Pending',
  created_at timestamp with time zone not null default now()
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_email text,
  user_name text,
  ticket_type text not null,
  reference_id text,
  status text,
  created_at timestamp with time zone not null default now()
);

-- Table to prevent double voting on features
create table if not exists public.feature_request_votes (
  id uuid primary key default gen_random_uuid(),
  feature_request_id uuid references public.feature_requests(id) on delete cascade,
  user_id uuid,
  created_at timestamp with time zone not null default now(),
  unique (feature_request_id, user_id)
);

-- Enable Row Level Security to secure the tables while permitting client actions via open policies
alter table public.feedback_ratings enable row level security;
alter table public.ai_feedback enable row level security;
alter table public.bug_reports enable row level security;
alter table public.feature_requests enable row level security;
alter table public.support_tickets enable row level security;
alter table public.feature_request_votes enable row level security;

-- Open policies in case they are enabled
drop policy if exists "Enable all actions for all users" on public.feedback_ratings;
create policy "Enable all actions for all users" on public.feedback_ratings for all using (true) with check (true);

drop policy if exists "Enable all actions for all users" on public.ai_feedback;
create policy "Enable all actions for all users" on public.ai_feedback for all using (true) with check (true);

drop policy if exists "Enable all actions for all users" on public.bug_reports;
create policy "Enable all actions for all users" on public.bug_reports for all using (true) with check (true);

drop policy if exists "Enable all actions for all users" on public.feature_requests;
create policy "Enable all actions for all users" on public.feature_requests for all using (true) with check (true);

drop policy if exists "Enable all actions for all users" on public.support_tickets;
create policy "Enable all actions for all users" on public.support_tickets for all using (true) with check (true);

drop policy if exists "Enable all actions for all users" on public.feature_request_votes;
create policy "Enable all actions for all users" on public.feature_request_votes for all using (true) with check (true);

-- Register screenshot bucket
insert into storage.buckets (id, name, public) values ('bug-screenshots', 'bug-screenshots', true) on conflict (id) do nothing;

-- Storage object policies for bug-screenshots bucket
drop policy if exists "Enable public access on screenshots" on storage.objects;
create policy "Enable public access on screenshots" on storage.objects for select using (bucket_id = 'bug-screenshots');

drop policy if exists "Enable uploads on screenshots" on storage.objects;
create policy "Enable uploads on screenshots" on storage.objects for insert with check (bucket_id = 'bug-screenshots');

drop policy if exists "Enable updates on screenshots" on storage.objects;
create policy "Enable updates on screenshots" on storage.objects for update using (bucket_id = 'bug-screenshots');

drop policy if exists "Enable deletes on screenshots" on storage.objects;
create policy "Enable deletes on screenshots" on storage.objects for delete using (bucket_id = 'bug-screenshots');

notify pgrst, 'reload schema';

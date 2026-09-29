create extension if not exists "pgcrypto";

create table if not exists public.judgment_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  research_topic text not null,
  case_name text,
  citation text,
  court text,
  judge text,
  facts jsonb not null default '[]'::jsonb,
  issues jsonb not null default '[]'::jsonb,
  holdings jsonb not null default '[]'::jsonb,
  ratio_decidendi text,
  obiter_dicta text,
  relief_granted text,
  impact_analysis text,
  research_matrix jsonb not null default '[]'::jsonb,
  generated_report text not null,
  file_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_judgment_reports_user_id on public.judgment_reports(user_id);
create index if not exists idx_judgment_reports_created_at on public.judgment_reports(created_at desc);
create index if not exists idx_judgment_reports_case_name on public.judgment_reports using gin (to_tsvector('english', coalesce(case_name, '')));
create index if not exists idx_judgment_reports_search on public.judgment_reports using gin (
  to_tsvector(
    'english',
    coalesce(case_name, '') || ' ' ||
    coalesce(citation, '') || ' ' ||
    coalesce(court, '') || ' ' ||
    coalesce(judge, '') || ' ' ||
    coalesce(ratio_decidendi, '') || ' ' ||
    coalesce(research_topic, '') || ' ' ||
    coalesce(generated_report, '')
  )
);

alter table public.judgment_reports enable row level security;

drop policy if exists "users own judgment reports" on public.judgment_reports;
create policy "users own judgment reports" on public.judgment_reports
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.set_judgment_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_judgment_reports_updated_at on public.judgment_reports;
create trigger trg_judgment_reports_updated_at
before update on public.judgment_reports
for each row execute function public.set_judgment_reports_updated_at();

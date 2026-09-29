create table if not exists public.mock_test_papers (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  mode text not null,
  prompt text not null,
  specification jsonb not null default '{}'::jsonb,
  coverage_snapshot jsonb not null default '{}'::jsonb,
  assembly_sections jsonb not null default '[]'::jsonb,
  question_ids text,
  total_marks integer not null default 0,
  duration_minutes integer not null default 0,
  status text not null default 'ready',
  shortfalls text,
  pdf_base64 text not null,
  generation_time_ms integer not null default 0,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mock_test_papers_user_created
on public.mock_test_papers(user_id, created_at desc);

create index if not exists idx_mock_test_papers_user_mode_created
on public.mock_test_papers(user_id, mode, created_at desc);

create table if not exists public.mock_test_paper_questions (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.mock_test_papers(id) on delete cascade,
  user_id text not null,
  question_id uuid not null references public.question_bank_entries(id) on delete cascade,
  question_number integer not null,
  section_label text not null,
  question text not null,
  question_type text not null,
  difficulty text not null,
  topic text not null,
  subtopic text not null,
  mark_value integer not null,
  quality_score double precision not null default 0,
  created_at timestamptz not null default now(),
  unique (paper_id, question_number)
);

create index if not exists idx_mock_test_paper_questions_user_question
on public.mock_test_paper_questions(user_id, question_id);

alter table public.mock_test_papers enable row level security;
alter table public.mock_test_paper_questions enable row level security;

create policy "mock_test_papers_user_isolation"
on public.mock_test_papers
for all
using (user_id = coalesce(auth.jwt() ->> 'sub', current_setting('request.jwt.claim.sub', true)))
with check (user_id = coalesce(auth.jwt() ->> 'sub', current_setting('request.jwt.claim.sub', true)));

create policy "mock_test_paper_questions_user_isolation"
on public.mock_test_paper_questions
for all
using (user_id = coalesce(auth.jwt() ->> 'sub', current_setting('request.jwt.claim.sub', true)))
with check (user_id = coalesce(auth.jwt() ->> 'sub', current_setting('request.jwt.claim.sub', true)));

-- Exam Command Center flagship readiness system.

alter table public.exams
  add column if not exists university text not null default '',
  add column if not exists available_hours_per_day numeric not null default 3 check (available_hours_per_day >= 0),
  add column if not exists difficulty_level text not null default 'Medium'
    check (difficulty_level in ('Easy', 'Medium', 'Hard')),
  add column if not exists credits_weightage integer not null default 4 check (credits_weightage >= 0);

create table if not exists public.exam_topics (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  status text not null default 'Not Started'
    check (status in ('Not Started', 'In Progress', 'Completed', 'Needs Revision')),
  difficulty text not null default 'Medium' check (difficulty in ('Easy', 'Medium', 'Hard')),
  quiz_score integer not null default 0 check (quiz_score >= 0 and quiz_score <= 100),
  flashcard_score integer not null default 0 check (flashcard_score >= 0 and flashcard_score <= 100),
  mastery_score integer not null default 0 check (mastery_score >= 0 and mastery_score <= 100),
  pyq_frequency integer not null default 1 check (pyq_frequency >= 0),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.exam_mock_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  paper_type text not null
    check (paper_type in ('University Style Paper', 'PYQ Style Paper', 'MCQ Test', 'Case Based Questions', 'Short Notes', 'Long Questions')),
  title text not null,
  attempt_score integer check (attempt_score >= 0 and attempt_score <= 100),
  time_taken_minutes integer check (time_taken_minutes >= 0),
  accuracy integer check (accuracy >= 0 and accuracy <= 100),
  scheduled_date date not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.exam_forge_assets (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  topic_id uuid references public.exam_topics(id) on delete set null,
  asset_type text not null check (asset_type in ('Notes', 'Flashcards', 'MCQs', 'Revision Sheet', 'One Page Summary')),
  title text not null,
  content jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_exam_topics_exam_id on public.exam_topics(exam_id);
create index if not exists idx_exam_topics_user_id on public.exam_topics(user_id);
create index if not exists idx_exam_mock_attempts_exam_id on public.exam_mock_attempts(exam_id);
create index if not exists idx_exam_forge_assets_exam_id on public.exam_forge_assets(exam_id);

alter table public.exam_topics enable row level security;
alter table public.exam_mock_attempts enable row level security;
alter table public.exam_forge_assets enable row level security;

drop policy if exists "users own exam topics" on public.exam_topics;
create policy "users own exam topics" on public.exam_topics
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "users own exam mock attempts" on public.exam_mock_attempts;
create policy "users own exam mock attempts" on public.exam_mock_attempts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "users own exam forge assets" on public.exam_forge_assets;
create policy "users own exam forge assets" on public.exam_forge_assets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

notify pgrst, 'reload schema';

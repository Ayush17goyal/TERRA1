create table if not exists public.answer_evaluation_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  question_id uuid references public.question_bank_entries(id) on delete set null,
  model_answer_id uuid references public.model_answer_entries(id) on delete set null,
  student_answer text not null,
  question text not null,
  rubric jsonb not null default '[]'::jsonb,
  model_answer_components jsonb not null default '[]'::jsonb,
  examiner_keywords jsonb not null default '[]'::jsonb,
  criteria_scores jsonb not null default '[]'::jsonb,
  dimension_marks jsonb not null default '{}'::jsonb,
  marks_awarded double precision not null default 0,
  max_marks double precision not null default 0,
  percentage double precision not null default 0,
  time_spent_seconds integer,
  strengths jsonb not null default '[]'::jsonb,
  weaknesses jsonb not null default '[]'::jsonb,
  suggestions jsonb not null default '[]'::jsonb,
  status text not null default 'evaluated',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_answer_eval_attempts_user_created
on public.answer_evaluation_attempts(user_id, created_at desc);

create index if not exists idx_answer_eval_attempts_user_question_created
on public.answer_evaluation_attempts(user_id, question_id, created_at desc);

alter table public.answer_evaluation_attempts enable row level security;

create policy "answer_evaluation_attempts_user_isolation"
on public.answer_evaluation_attempts
for all
using (user_id = coalesce(auth.jwt() ->> 'sub', current_setting('request.jwt.claim.sub', true)))
with check (user_id = coalesce(auth.jwt() ->> 'sub', current_setting('request.jwt.claim.sub', true)));




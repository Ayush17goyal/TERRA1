-- Learning Progress Tracker tables for LEGATRIXON LexMentor AI

create extension if not exists pgcrypto;

create table if not exists public.learning_progress (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  progress_percentage numeric not null default 0,
  readiness_score numeric not null default 0,
  weak_topics jsonb not null default '[]'::jsonb,
  completed_topics jsonb not null default '[]'::jsonb,
  quiz_scores jsonb not null default '[]'::jsonb,
  study_time numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_materials (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null,
  file_name text not null,
  file_type text not null check (file_type in ('pdf', 'docx', 'txt', 'pptx')),
  file_size bigint not null default 0,
  storage_path text,
  extracted_text text,
  status text not null default 'uploaded',
  weak_topics jsonb not null default '[]'::jsonb,
  completed_topics jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  material_id uuid references public.study_materials(id) on delete set null,
  topic text,
  duration_minutes numeric not null default 0,
  study_time numeric not null default 0,
  completed_topics jsonb not null default '[]'::jsonb,
  quiz_scores jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exam_readiness (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  subject text,
  readiness_score numeric not null default 0,
  confidence_meter numeric not null default 0,
  subject_preparedness numeric not null default 0,
  recommended_study_hours numeric not null default 0,
  weak_topics jsonb not null default '[]'::jsonb,
  quiz_scores jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.performance_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  metric_date date not null default current_date,
  progress_percentage numeric not null default 0,
  topic_completion_percentage numeric not null default 0,
  flashcard_completion_percentage numeric not null default 0,
  quiz_score numeric not null default 0,
  quiz_scores jsonb not null default '[]'::jsonb,
  study_time numeric not null default 0,
  weekly_insights text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mastery_analytics (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  topic text not null,
  mastery_level numeric not null default 0,
  heatmap_score numeric not null default 0,
  learning_velocity numeric not null default 0,
  retention_prediction numeric not null default 0,
  improvement_trend numeric not null default 0,
  weak_topics jsonb not null default '[]'::jsonb,
  completed_topics jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_learning_progress_user_updated on public.learning_progress(user_id, updated_at desc);
create index if not exists idx_study_materials_user_created on public.study_materials(user_id, created_at desc);
create index if not exists idx_study_sessions_user_created on public.study_sessions(user_id, created_at desc);
create index if not exists idx_exam_readiness_user_updated on public.exam_readiness(user_id, updated_at desc);
create index if not exists idx_performance_metrics_user_date on public.performance_metrics(user_id, metric_date desc);
create index if not exists idx_mastery_analytics_user_updated on public.mastery_analytics(user_id, updated_at desc);

alter table public.learning_progress enable row level security;
alter table public.study_materials enable row level security;
alter table public.study_sessions enable row level security;
alter table public.exam_readiness enable row level security;
alter table public.performance_metrics enable row level security;
alter table public.mastery_analytics enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['learning_progress', 'study_materials', 'study_sessions', 'exam_readiness', 'performance_metrics', 'mastery_analytics'] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_own_records', table_name);
    execute format(
      'create policy %I on public.%I for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text)',
      table_name || '_own_records',
      table_name
    );
  end loop;
end $$;
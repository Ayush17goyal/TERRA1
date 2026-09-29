create table if not exists public.ai_learning_sources (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  kind text not null,
  name text not null,
  url text,
  storage_path text,
  mime_type text,
  text_length integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_mock_tests (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  topic text not null,
  difficulty text not null,
  question_type text not null,
  question_count integer not null,
  source_ids jsonb not null default '[]'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  score_report jsonb not null default '{}'::jsonb,
  weak_areas jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_mock_test_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  mock_test_id uuid not null references public.ai_mock_tests(id) on delete cascade,
  score integer not null,
  total integer not null,
  percentage integer not null,
  answers jsonb not null default '{}'::jsonb,
  weak_areas jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_mind_maps (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null,
  source_ids jsonb not null default '[]'::jsonb,
  map jsonb not null default '{}'::jsonb,
  concepts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_study_kits (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null,
  source_ids jsonb not null default '[]'::jsonb,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_flashcard_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  study_kit_id uuid not null references public.ai_study_kits(id) on delete cascade,
  card_id text not null,
  rating text not null,
  correct boolean not null default false,
  topic text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_learning_activity (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_learning_sources_user_created on public.ai_learning_sources(user_id, created_at desc);
create index if not exists idx_ai_mock_tests_user_created on public.ai_mock_tests(user_id, created_at desc);
create index if not exists idx_ai_mock_attempts_user_created on public.ai_mock_test_attempts(user_id, created_at desc);
create index if not exists idx_ai_mind_maps_user_created on public.ai_mind_maps(user_id, created_at desc);
create index if not exists idx_ai_study_kits_user_created on public.ai_study_kits(user_id, created_at desc);
create index if not exists idx_ai_flashcard_reviews_user_created on public.ai_flashcard_reviews(user_id, created_at desc);
create index if not exists idx_ai_learning_activity_user_created on public.ai_learning_activity(user_id, created_at desc);

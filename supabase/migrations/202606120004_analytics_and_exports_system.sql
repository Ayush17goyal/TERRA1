-- Migration: Analytics, Flashcards, Quiz Results and Exports DB Schema

-- 1. Update user_activity_logs to match required columns
ALTER TABLE public.user_activity_logs 
  ADD COLUMN IF NOT EXISTS module_name text,
  ADD COLUMN IF NOT EXISTS action_type text,
  ADD COLUMN IF NOT EXISTS session_id text;

-- Backfill existing columns if they are empty
UPDATE public.user_activity_logs
SET module_name = module, action_type = action
WHERE module_name IS NULL OR action_type IS NULL;

-- Disable RLS for ease of read/write sync (consistent with user_data_sync_system)
ALTER TABLE public.user_activity_logs DISABLE ROW LEVEL SECURITY;

-- 2. Create research_history table
CREATE TABLE IF NOT EXISTS public.research_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  query text NOT NULL,
  report_title text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.research_history DISABLE ROW LEVEL SECURITY;

-- 3. Create flashcards table
CREATE TABLE IF NOT EXISTS public.flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  topic text NOT NULL,
  mastery_level integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.flashcards DISABLE ROW LEVEL SECURITY;

-- 4. Create quiz_results table
CREATE TABLE IF NOT EXISTS public.quiz_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  quiz_title text NOT NULL,
  score integer NOT NULL,
  total_questions integer NOT NULL DEFAULT 10,
  correct_answers integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quiz_results DISABLE ROW LEVEL SECURITY;

-- 5. Create exports table
CREATE TABLE IF NOT EXISTS public.exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  export_type text NOT NULL,
  format text NOT NULL,
  file_name text NOT NULL,
  downloaded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.exports DISABLE ROW LEVEL SECURITY;

-- Notify pgrst to reload schema
NOTIFY pgrst, 'reload schema';

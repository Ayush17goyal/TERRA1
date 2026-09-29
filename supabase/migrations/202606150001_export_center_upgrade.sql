-- Migration: Legatrixon Export Center Upgrade DB Schema
-- Creates user_notes, analytics, progress_reports, and ensures research_history, flashcards, quiz_results, exports exist with all required columns.

-- 1. Create user_notes table
CREATE TABLE IF NOT EXISTS public.user_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL, -- 'LexNotebook AI', 'Personal Notes', 'Research Notes', 'Moot Court Notes', 'Saved Legal Notes'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_notes DISABLE ROW LEVEL SECURITY;

-- 2. Create analytics table
CREATE TABLE IF NOT EXISTS public.analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  feature_usage jsonb DEFAULT '{}'::jsonb,
  study_hours numeric DEFAULT 0,
  cases_studied integer DEFAULT 0,
  research_sessions integer DEFAULT 0,
  mastery_score integer DEFAULT 0,
  academic_progress integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.analytics DISABLE ROW LEVEL SECURITY;

-- 3. Create progress_reports table
CREATE TABLE IF NOT EXISTS public.progress_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  student_name text,
  university text,
  semester text,
  mastery_score numeric DEFAULT 0,
  study_streak integer DEFAULT 0,
  quiz_performance numeric DEFAULT 0,
  research_performance numeric DEFAULT 0,
  study_hours numeric DEFAULT 0,
  flashcard_usage integer DEFAULT 0,
  calendar_activities integer DEFAULT 0,
  internship_activities integer DEFAULT 0,
  strength_analysis text,
  weakness_analysis text,
  ai_recommendations text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.progress_reports DISABLE ROW LEVEL SECURITY;

-- 4. Create and enhance research_history table
CREATE TABLE IF NOT EXISTS public.research_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  query text NOT NULL,
  report_title text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.research_history DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.research_history
  ADD COLUMN IF NOT EXISTS question text,
  ADD COLUMN IF NOT EXISTS answer text,
  ADD COLUMN IF NOT EXISTS sources_used jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS research_category text;

-- 5. Ensure flashcards table exists
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

-- 6. Ensure quiz_results table exists
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

-- 7. Ensure exports table exists
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

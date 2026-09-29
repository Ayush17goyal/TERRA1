-- LEGATRIXON Bare Act Mentor performance indexes.
-- Defensive migration: every index is created only when the table/column exists.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'created_at') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_desc ON public.audit_logs (created_at DESC)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'actor_id') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created ON public.audit_logs (actor_id, created_at DESC)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'action') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON public.audit_logs (action, created_at DESC)';
    END IF;
  END IF;

  IF to_regclass('public.mentor_interactions') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_mentor_interactions_student_created ON public.mentor_interactions (student_id, created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_mentor_interactions_intent_created ON public.mentor_interactions (intent, created_at DESC)';
  END IF;

  IF to_regclass('public.drafting_sessions') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_drafting_sessions_student_updated ON public.drafting_sessions (student_id, updated_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_drafting_sessions_project_status ON public.drafting_sessions (project_id, status)';
  END IF;

  IF to_regclass('public.student_mastery') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_student_mastery_student_skill ON public.student_mastery (student_id, skill_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_student_mastery_state_updated ON public.student_mastery (mastery_state, updated_at DESC)';
  END IF;

  IF to_regclass('public.student_weaknesses') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_student_weaknesses_student_active ON public.student_weaknesses (student_id, active, updated_at DESC)';
  END IF;

  IF to_regclass('public.prompt_logs') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_prompt_logs_student_created ON public.prompt_logs (student_id, created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_prompt_logs_version_created ON public.prompt_logs (prompt_version, created_at DESC)';
  END IF;

  IF to_regclass('public.documents') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_documents_owner_status_updated ON public.documents (owner_id, status, updated_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_documents_type_status ON public.documents (document_type, status)';
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'title') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_documents_title_trgm ON public.documents USING gin (title gin_trgm_ops)';
    END IF;
  END IF;

  IF to_regclass('public.knowledge_chunks') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_kind_component ON public.knowledge_chunks (kind, component_type)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_lesson_module ON public.knowledge_chunks (module_id, lesson_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document_component ON public.knowledge_chunks (document_id, component_type)';
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'knowledge_chunks' AND column_name = 'content') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_content_trgm ON public.knowledge_chunks USING gin (content gin_trgm_ops)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'knowledge_chunks' AND column_name = 'metadata') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_metadata_gin ON public.knowledge_chunks USING gin (metadata)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'knowledge_chunks' AND column_name = 'embedding') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_hnsw ON public.knowledge_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)';
    END IF;
  END IF;

  IF to_regclass('public.document_chunks') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_document_chunks_document_component ON public.document_chunks (document_id, component_type)';
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'document_chunks' AND column_name = 'embedding') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw ON public.document_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)';
    END IF;
  END IF;
END $$;
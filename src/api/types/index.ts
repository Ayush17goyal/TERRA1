import type { MentorEventName } from '../../jobs/types';
import type { KnowledgeRetrievalResult } from '../../knowledge/types';
import type { LLMResponse, RuntimeDecisionPacket } from '../../llm/types';
import type { ValidationOutcome } from '../../validator/types';

export type ApiMethod = 'GET' | 'POST';

export type ApiRouteId =
  | 'chat'
  | 'chat_stream'
  | 'draft_review'
  | 'draft_revision'
  | 'lesson_start'
  | 'lesson_complete'
  | 'quiz_start'
  | 'quiz_submit'
  | 'assessment_start'
  | 'assessment_submit'
  | 'capstone_review'
  | 'bare_act_analyse'
  | 'documents_upload'
  | 'student_progress'
  | 'student_mastery'
  | 'student_projects'
  | 'student_history'
  | 'pattern_detail'
  | 'lesson_detail'
  | 'module_detail';

export interface ApiUser {
  id: string;
  email?: string;
  roles: string[];
  accessToken?: string;
}

export interface ApiRequestContext {
  requestId: string;
  correlationId: string;
  startedAt: number;
  method: ApiMethod;
  path: string;
  params: Record<string, string>;
  user?: ApiUser;
}

export interface ApiSuccessResponse<TData = unknown> {
  ok: true;
  requestId: string;
  data: TData;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  ok: false;
  requestId: string;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ApiRouteDefinition {
  id: ApiRouteId;
  method: ApiMethod;
  path: string;
  requiresAuth: boolean;
  requiredRoles?: string[];
}

export interface ApiPipelineResult {
  packet?: RuntimeDecisionPacket;
  retrieval?: KnowledgeRetrievalResult;
  llm?: LLMResponse;
  validation?: ValidationOutcome;
}

export interface PersistenceAdapter {
  saveInteraction(record: Record<string, unknown>): Promise<void>;
  saveProgress(record: Record<string, unknown>): Promise<void>;
  getStudentResource(kind: 'progress' | 'mastery' | 'projects' | 'history', userId: string): Promise<unknown>;
  getKnowledgeResource(kind: 'pattern' | 'lesson' | 'module', id: string, userId?: string): Promise<unknown>;
  saveDocumentUpload(record: Record<string, unknown>): Promise<void>;
}

export interface EventPublisher {
  emit(event: {
    name: MentorEventName;
    payload: Record<string, unknown>;
    correlationId?: string;
    studentId?: string;
    interactionId?: string;
  }): Promise<unknown>;
}

export interface SupabaseAuthClient {
  auth: {
    getUser(token: string): Promise<{
      data?: { user?: { id: string; email?: string; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null };
      error?: unknown;
    }>;
  };
}

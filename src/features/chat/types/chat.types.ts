export type ChatRole = 'student' | 'mentor' | 'system';
export type MessageStatus = 'queued' | 'sending' | 'streaming' | 'complete' | 'failed' | 'cancelled';
export type WorkflowStage =
  | 'PENDING'
  | 'RUNNING'
  | 'WAITING_FOR_LLM'
  | 'VALIDATING'
  | 'UPDATING_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type MentorResponseKind =
  | 'explanation'
  | 'draft_review'
  | 'revision_guidance'
  | 'quiz'
  | 'reflection_questions'
  | 'next_action'
  | 'learning_objective'
  | 'progress_update'
  | 'assessment_feedback'
  | 'capstone_review'
  | 'bare_act_analysis';

export interface MentorCitation {
  label: string;
  source?: string;
  url?: string;
}

export interface MentorStructuredSection {
  kind: MentorResponseKind;
  title: string;
  content: string;
  items?: string[];
  score?: number;
  citations?: MentorCitation[];
}

export interface ChatAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  status: 'queued' | 'uploading' | 'processing' | 'indexed' | 'failed';
  progress: number;
  documentId?: string;
  error?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  updatedAt?: string;
  status: MessageStatus;
  attachments?: ChatAttachment[];
  citations?: MentorCitation[];
  structured?: MentorStructuredSection[];
  workflow?: WorkflowStage;
  error?: string;
  requestId?: string;
  interactionId?: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  lessonId?: string;
  lessonTitle?: string;
  moduleId?: string;
  messages: ChatMessage[];
}

export interface MentorChatRequest {
  message: string;
  conversationId: string;
  sessionId?: string;
  moduleId?: string;
  lessonId?: string;
  projectId?: string;
  studentLevel?: 'beginner' | 'developing' | 'intermediate' | 'advanced' | 'capstone' | 'professional_review';
  jurisdiction?: string;
  patternNames?: string[];
  componentTypes?: string[];
  draftText?: string;
  draftObjective?: string;
  previousFeedback?: string;
  attachments?: ChatAttachment[];
}

export interface WorkflowStatusEvent {
  state?: WorkflowStage;
  message?: string;
  stage?: string;
}

export type MentorStreamEvent =
  | { event: 'state'; data: WorkflowStatusEvent }
  | { event: 'text'; data: { delta?: string } }
  | { event: 'tool'; data: { toolCall?: { name?: string; arguments?: Record<string, unknown> } } }
  | { event: 'validation'; data: { action?: string; violations?: Array<{ message: string; severity: string }> } }
  | { event: 'completion'; data: { text?: string; response?: { text?: string }; metadata?: Record<string, unknown>; structured?: MentorStructuredSection[] } }
  | { event: 'error'; data: { message?: string; code?: string } }
  | { event: 'cancelled'; data: Record<string, unknown> };

export interface ChatApiError extends Error {
  status?: number;
  code?: string;
  retryAfterMs?: number;
}


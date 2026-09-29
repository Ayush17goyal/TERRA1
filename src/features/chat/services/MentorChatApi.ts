import { supabase } from '../../../lib/supabase-client';
import type { ChatApiError, ChatAttachment, MentorChatRequest, MentorStreamEvent } from '../types/chat.types';

const configuredBase = ((import.meta as any).env?.VITE_BARE_ACT_MENTOR_API_BASE || '').replace(/\/+$/, '');
const API_BASE = configuredBase || '';

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseError(response: Response): Promise<ChatApiError> {
  let payload: any = undefined;
  try { payload = await response.json(); } catch {}
  const error = new Error(payload?.error?.message || payload?.message || `Request failed with ${response.status}`) as ChatApiError;
  error.status = response.status;
  error.code = payload?.error?.code || payload?.code;
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) error.retryAfterMs = Number(retryAfter) * 1000;
  return error;
}

export class MentorChatApi {
  async sendMessage(request: MentorChatRequest, signal?: AbortSignal): Promise<{ text: string; metadata?: Record<string, unknown> }> {
    const headers = await authHeaders();
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(this.toApiBody(request)),
      signal,
    });
    if (!response.ok) throw await parseError(response);
    const payload = await response.json();
    return { text: payload?.data?.responseText || payload?.data?.text || payload?.text || '', metadata: payload?.meta || payload?.data?.metadata };
  }

  async *streamMessage(request: MentorChatRequest, signal?: AbortSignal): AsyncGenerator<MentorStreamEvent> {
    const headers = await authHeaders();
    const response = await fetch(`${API_BASE}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...headers },
      body: JSON.stringify(this.toApiBody(request)),
      signal,
    });
    if (!response.ok) throw await parseError(response);
    if (!response.body) throw new Error('Streaming response body is unavailable.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split(/\n\n/);
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          const event = this.parseSseFrame(frame);
          if (event) yield event;
        }
      }
      if (buffer.trim()) {
        const event = this.parseSseFrame(buffer);
        if (event) yield event;
      }
    } finally {
      reader.releaseLock();
    }
  }

  async uploadDocument(file: File, onProgress?: (progress: number) => void, signal?: AbortSignal): Promise<Partial<ChatAttachment>> {
    const contentBase64 = await this.readBase64(file, (progress) => onProgress?.(Math.min(40, progress * 0.4)));
    onProgress?.(45);
    const headers = await authHeaders();
    const response = await fetch(`${API_BASE}/api/documents/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ fileName: file.name, mimeType: file.type || 'application/octet-stream', contentBase64, documentType: this.documentType(file) }),
      signal,
    });
    onProgress?.(75);
    if (!response.ok) throw await parseError(response);
    const payload = await response.json();
    onProgress?.(100);
    return { documentId: payload?.data?.documentId || payload?.documentId, status: 'processing', progress: 100 };
  }

  private toApiBody(request: MentorChatRequest): Record<string, unknown> {
    return {
      message: request.message,
      sessionId: request.conversationId,
      moduleId: request.moduleId,
      lessonId: request.lessonId,
      projectId: request.projectId,
      studentLevel: request.studentLevel ?? 'beginner',
      jurisdiction: request.jurisdiction,
      patternNames: request.patternNames,
      componentTypes: request.componentTypes,
      draftText: request.draftText,
      draftObjective: request.draftObjective,
      previousFeedback: request.previousFeedback,
      attachments: request.attachments?.map((attachment) => ({ documentId: attachment.documentId, fileName: attachment.fileName, status: attachment.status })),
    };
  }

  private parseSseFrame(frame: string): MentorStreamEvent | null {
    const lines = frame.split('\n').map((line) => line.trim()).filter(Boolean);
    const eventName = lines.find((line) => line.startsWith('event:'))?.slice(6).trim() || 'message';
    const dataLines = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim());
    if (!dataLines.length) return null;
    let data: any = dataLines.join('\n');
    try { data = JSON.parse(data); } catch {}
    const event = eventName === 'message' && data?.event ? data.event : eventName;
    const payload = eventName === 'message' && data?.data ? data.data : data;
    if (['state', 'text', 'tool', 'validation', 'completion', 'error', 'cancelled'].includes(event)) {
      return { event, data: payload } as MentorStreamEvent;
    }
    return null;
  }

  private readBase64(file: File, onProgress?: (progress: number) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Unable to read file.'));
      reader.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.((event.loaded / event.total) * 100);
      };
      reader.onload = () => {
        const result = String(reader.result ?? '');
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.readAsDataURL(file);
    });
  }

  private documentType(file: File): string {
    const name = file.name.toLowerCase();
    if (name.includes('rubric')) return 'rubric';
    if (name.includes('assignment')) return 'assignment';
    if (name.includes('draft')) return 'student_draft';
    if (name.includes('act') || name.includes('bare')) return 'bare_act';
    return 'notes';
  }
}

export const mentorChatApi = new MentorChatApi();



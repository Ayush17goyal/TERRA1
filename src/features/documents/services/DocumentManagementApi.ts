import { z } from 'zod';
import { supabase } from '../../../lib/supabase-client';
import type { AiDocumentAnalysis, ManagedDocument, ManagedDocumentType } from '../types/document.types';
import { inferDocumentType } from '../utils/documentUtils';

const API_BASE = ((import.meta as any).env?.VITE_BARE_ACT_MENTOR_API_BASE || '').replace(/\/+$/, '');

type UploadDocumentType = 'bare_act' | 'student_draft' | 'assignment_prompt' | 'teacher_note' | 'other';

export const documentMetadataSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()),
  category: z.string().min(1),
  moduleId: z.string().optional(),
  lessonId: z.string().optional(),
  visibility: z.enum(['private', 'course', 'platform']),
});

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseError(response: Response): Promise<Error> {
  let message = `Request failed with ${response.status}`;
  try { message = (await response.json())?.error?.message ?? message; } catch {}
  return new Error(message);
}

function toUploadDocumentType(type: ManagedDocumentType): UploadDocumentType {
  if (type === 'bare_act') return 'bare_act';
  if (type === 'student_draft') return 'student_draft';
  if (type === 'assignment') return 'assignment_prompt';
  if (type === 'teacher_material') return 'teacher_note';
  return 'other';
}

export class DocumentManagementApi {
  async upload(file: File, documentType?: ManagedDocumentType, onProgress?: (progress: number) => void, signal?: AbortSignal): Promise<{ documentId: string; raw: unknown }> {
    const contentBase64 = await this.readBase64(file, (progress) => onProgress?.(Math.min(42, progress * 0.42)));
    const inferredType = documentType ?? inferDocumentType(file.name);
    onProgress?.(48);
    const headers = await authHeaders();
    const response = await fetch(`${API_BASE}/api/documents/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ fileName: file.name, mimeType: file.type || 'application/octet-stream', contentBase64, documentType: toUploadDocumentType(inferredType) }),
      signal,
    });
    onProgress?.(78);
    if (!response.ok) throw await parseError(response);
    const payload = await response.json();
    onProgress?.(100);
    return { documentId: payload?.data?.documentId || payload?.documentId || crypto.randomUUID(), raw: payload };
  }

  async analyseBareAct(document: ManagedDocument): Promise<Partial<AiDocumentAnalysis>> {
    if (!document.textContent && !document.title) return {};
    const headers = await authHeaders();
    const response = await fetch(`${API_BASE}/api/bare-act/analyse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ message: `Analyse document metadata for ${document.title}`, bareActTitle: document.title, excerpt: document.textContent?.slice(0, 6000), analysisFocus: 'drafting patterns and structure' }),
    });
    if (!response.ok) return {};
    const payload = await response.json();
    const text = payload?.data?.validation?.response?.text || payload?.data?.llm?.text || payload?.text || '';
    return { processingSummary: text.slice(0, 900) };
  }

  async loadBackendHints(): Promise<{ history?: unknown; projects?: unknown }> {
    const headers = await authHeaders();
    const [history, projects] = await Promise.allSettled([
      fetch(`${API_BASE}/api/student/history`, { headers }).then((res) => res.ok ? res.json() : undefined),
      fetch(`${API_BASE}/api/student/projects`, { headers }).then((res) => res.ok ? res.json() : undefined),
    ]);
    return {
      history: history.status === 'fulfilled' ? history.value : undefined,
      projects: projects.status === 'fulfilled' ? projects.value : undefined,
    };
  }

  private readBase64(file: File, onProgress?: (progress: number) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Unable to read file.'));
      reader.onprogress = (event) => { if (event.lengthComputable) onProgress?.((event.loaded / event.total) * 100); };
      reader.onload = () => {
        const result = String(reader.result ?? '');
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.readAsDataURL(file);
    });
  }
}

export const documentManagementApi = new DocumentManagementApi();

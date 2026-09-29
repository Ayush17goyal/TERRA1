import { supabase } from '../../../lib/supabase-client';
import type { DraftReviewRequest, DraftRevisionRequest, EducationalSidebarData } from '../types/drafting.types';

const API_BASE = ((import.meta as any).env?.VITE_BARE_ACT_MENTOR_API_BASE || '').replace(/\/+$/, '');

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await authHeaders();
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...headers, ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try { message = (await response.json())?.error?.message ?? message; } catch {}
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export class DraftingApi {
  async reviewDraft(payload: DraftReviewRequest): Promise<{ text: string; raw: unknown }> {
    const response = await requestJson<any>('/api/draft/review', { method: 'POST', body: JSON.stringify(payload) });
    return { text: response?.data?.validation?.response?.text || response?.data?.llm?.text || response?.data?.text || response?.text || '', raw: response };
  }

  async submitRevision(payload: DraftRevisionRequest): Promise<{ text: string; raw: unknown }> {
    const response = await requestJson<any>('/api/draft/revision', { method: 'POST', body: JSON.stringify(payload) });
    return { text: response?.data?.validation?.response?.text || response?.data?.llm?.text || response?.data?.text || response?.text || '', raw: response };
  }

  async getSidebarData(moduleId?: string, lessonId?: string): Promise<EducationalSidebarData> {
    const [progress, mastery, history] = await Promise.allSettled([
      requestJson<any>('/api/student/progress'),
      requestJson<any>('/api/student/mastery'),
      requestJson<any>('/api/student/history'),
    ]);
    const data = {
      progress: progress.status === 'fulfilled' ? progress.value?.data ?? progress.value : undefined,
      mastery: mastery.status === 'fulfilled' ? mastery.value?.data ?? mastery.value : undefined,
      history: history.status === 'fulfilled' ? history.value?.data ?? history.value : undefined,
    };
    return {
      lessonObjective: data.progress?.currentObjective || 'Draft one statutory component with clear actor, condition, power or duty, and consequence.',
      checklist: data.progress?.checklist || ['Identify the legal actor', 'State the operative verb', 'Define key terms', 'Check commencement and extent', 'Verify cross-references'],
      commonMistakes: data.history?.commonMistakes || ['Undefined terms', 'Vague operative language', 'Overbroad delegation', 'Missing procedural sequence'],
      relevantPattern: data.progress?.pattern || (lessonId || moduleId ? 'Current lesson drafting pattern' : 'Definitions and operative provisions'),
      reflectionQuestions: data.progress?.reflectionQuestions || ['Who must act?', 'When does the duty arise?', 'What happens if the provision is breached?'],
      weaknessReminders: data.mastery?.weaknesses || ['Keep each provision teachable and testable.'],
      masteryProgress: Number(data.mastery?.progress ?? data.progress?.masteryProgress ?? 42),
    };
  }
}

export const draftingApi = new DraftingApi();

import { z } from 'zod';
import { supabase } from '../../../lib/supabase-client';
import type { LearningPlatformData } from '../types/learning.types';
import { buildLearningData } from '../utils/learningData';

const API_BASE = ((import.meta as any).env?.VITE_BARE_ACT_MENTOR_API_BASE || '').replace(/\/+$/, '');

const quizSubmitSchema = z.object({
  quizId: z.string().min(1),
  lessonId: z.string().min(1),
  answers: z.record(z.string(), z.string()),
});

const assessmentSubmitSchema = z.object({
  assessmentId: z.string().min(1),
  submission: z.string().min(20),
});

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

export class LearningApi {
  async loadPlatform(): Promise<LearningPlatformData> {
    const [progress, mastery, projects, history] = await Promise.allSettled([
      requestJson<any>('/api/student/progress'),
      requestJson<any>('/api/student/mastery'),
      requestJson<any>('/api/student/projects'),
      requestJson<any>('/api/student/history'),
    ]);
    return buildLearningData({
      progress: progress.status === 'fulfilled' ? progress.value?.data ?? progress.value : undefined,
      mastery: mastery.status === 'fulfilled' ? mastery.value?.data ?? mastery.value : undefined,
      projects: projects.status === 'fulfilled' ? projects.value?.data ?? projects.value : undefined,
      history: history.status === 'fulfilled' ? history.value?.data ?? history.value : undefined,
    });
  }

  async startLesson(moduleId: string, lessonId: string): Promise<unknown> {
    return requestJson('/api/lesson/start', { method: 'POST', body: JSON.stringify({ moduleId, lessonId }) });
  }

  async completeLesson(moduleId: string, lessonId: string): Promise<unknown> {
    return requestJson('/api/lesson/complete', { method: 'POST', body: JSON.stringify({ moduleId, lessonId }) });
  }

  async startQuiz(moduleId: string, lessonId: string): Promise<unknown> {
    return requestJson('/api/quiz/start', { method: 'POST', body: JSON.stringify({ moduleId, lessonId }) });
  }

  async submitQuiz(input: z.infer<typeof quizSubmitSchema>): Promise<unknown> {
    const parsed = quizSubmitSchema.parse(input);
    return requestJson('/api/quiz/submit', {
      method: 'POST',
      body: JSON.stringify({ moduleId: 'module-1', lessonId: parsed.lessonId, answers: Object.entries(parsed.answers).map(([questionId, answer]) => ({ questionId, answer })) }),
    });
  }

  async startAssessment(moduleId: string, lessonId: string, assessmentId: string): Promise<unknown> {
    return requestJson('/api/assessment/start', { method: 'POST', body: JSON.stringify({ moduleId, lessonId, assessmentId }) });
  }

  async submitAssessment(input: z.infer<typeof assessmentSubmitSchema>): Promise<unknown> {
    const parsed = assessmentSubmitSchema.parse(input);
    return requestJson('/api/assessment/submit', {
      method: 'POST',
      body: JSON.stringify({ moduleId: 'module-1', lessonId: 'lesson-1-1', assessmentId: parsed.assessmentId, submission: { text: parsed.submission } }),
    });
  }

  async reviewCapstone(draftText: string): Promise<unknown> {
    return requestJson('/api/capstone/review', { method: 'POST', body: JSON.stringify({ message: 'Review capstone progress', draftText, draftObjective: 'Capstone Bare Act review' }) });
  }
}

export const learningApi = new LearningApi();
export { quizSubmitSchema, assessmentSubmitSchema };

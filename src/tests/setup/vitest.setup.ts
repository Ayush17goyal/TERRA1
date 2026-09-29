import '@testing-library/jest-dom/vitest';
import type React from 'react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from '../mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
  });
}

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', { writable: true, value: ResizeObserverMock });
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(), fillRect: vi.fn(), getImageData: vi.fn(() => ({ data: [] })), putImageData: vi.fn(), createImageData: vi.fn(), setTransform: vi.fn(), drawImage: vi.fn(), save: vi.fn(), fillText: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), stroke: vi.fn(), translate: vi.fn(), scale: vi.fn(), rotate: vi.fn(), arc: vi.fn(), fill: vi.fn(), measureText: vi.fn(() => ({ width: 0 })), transform: vi.fn(), rect: vi.fn(), clip: vi.fn(),
  })) as any;
}

if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID: () => `test-${Math.random().toString(36).slice(2)}`, subtle: globalThis.crypto?.subtle },
  });
}

vi.mock('@clerk/clerk-react', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ isSignedIn: true, userId: 'test-user', getToken: async () => 'test-token' }),
  useUser: () => ({ isLoaded: true, user: { id: 'test-user', primaryEmailAddress: { emailAddress: 'admin@legatrixon.com' }, publicMetadata: { role: 'admin' } } }),
  useClerk: () => ({ signOut: vi.fn() }),
  useSignIn: () => ({}),
  useSignUp: () => ({}),
}));

vi.mock('../../lib/supabase-client', () => {
  const rows: Record<string, any[]> = {
    users: [{ id: 'student-1', email: 'student@example.com', name: 'Student One', role: 'student', lessons_completed: 3, assessments_completed: 1, updated_at: new Date().toISOString() }],
    user_profiles: [],
    lexmentor_turns: [{ id: 'turn-1', user_id: 'student-1', created_at: new Date().toISOString() }],
    lexmentor_sessions: [{ id: 'session-1', user_id: 'student-1', created_at: new Date().toISOString() }],
    lexmentor_analytics: [{ id: 'usage-1', tokens: 1200, cost: 0.02, created_at: new Date().toISOString() }],
    mentor_knowledge_chunks: [
      { id: 'pattern-definitions', kind: 'pattern', title: 'Definitions', content: 'Definitions pattern content', metadata: { patternName: 'Definitions', difficulty: 'beginner', checklist: ['necessity'], commonMistakes: ['over-definition'] }, created_at: new Date().toISOString() },
      { id: 'bare-1-0', kind: 'bare_act_component', title: 'Example Act', content: 'Section 1', metadata: { documentId: 'bare-1', title: 'Example Act', componentType: 'section' }, created_at: new Date().toISOString() },
    ],
    mentor_telemetry_events: [{ id: 'tel-1', payload: { ok: true }, recorded_at: new Date().toISOString() }],
    mentor_mastery_updates: [{ id: 'mastery-1', payload: { studentId: 'student-1', score: 76 }, updated_at: new Date().toISOString() }],
    mentor_weakness_updates: [{ id: 'weak-1', payload: { studentId: 'student-1', weakness: 'definitions' }, updated_at: new Date().toISOString() }],
    mentor_revision_schedule: [{ id: 'rev-1', payload: { studentId: 'student-1', status: 'complete' }, scheduled_at: new Date().toISOString() }],
    mentor_prompt_log_cleanup: [],
    mentor_dead_letter_jobs: [],
    mentor_notifications: [],
    mentor_admin_audit_logs: [],
    mentor_system_settings: [],
    mentor_role_assignments: [],
  };

  function tableApi(table: string) {
    const api: any = {
      select: vi.fn(() => ({ limit: vi.fn(async () => ({ data: rows[table] ?? [], error: null })) })),
      update: vi.fn(() => ({ eq: vi.fn(async () => ({ data: null, error: null })) })),
      insert: vi.fn(async (value: any) => { rows[table] = [...(rows[table] ?? []), value]; return { data: value, error: null }; }),
      upsert: vi.fn(async (value: any) => { rows[table] = [...(rows[table] ?? []), value]; return { data: value, error: null }; }),
    };
    return api;
  }

  return {
    supabase: {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'admin-1', email: 'admin@legatrixon.com', app_metadata: { roles: ['admin'] }, user_metadata: {} } }, error: null })),
        getSession: vi.fn(async () => ({ data: { session: { access_token: 'test-token' } }, error: null })),
      },
      from: vi.fn((table: string) => tableApi(table)),
      rpc: vi.fn(async () => ({ data: [], error: null })),
      removeChannel: vi.fn(),
      channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    },
  };
});






if (typeof window !== 'undefined') {
  const originalGetComputedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = ((element: Element, pseudoElt?: string | null) => originalGetComputedStyle(element, pseudoElt ?? undefined)) as typeof window.getComputedStyle;
}
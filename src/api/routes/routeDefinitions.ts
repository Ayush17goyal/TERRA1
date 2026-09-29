import type { ApiRouteDefinition } from '../types';

export const routeDefinitions: ApiRouteDefinition[] = [
  { id: 'chat', method: 'POST', path: '/api/chat', requiresAuth: true },
  { id: 'chat_stream', method: 'POST', path: '/api/chat/stream', requiresAuth: true },
  { id: 'draft_review', method: 'POST', path: '/api/draft/review', requiresAuth: true },
  { id: 'draft_revision', method: 'POST', path: '/api/draft/revision', requiresAuth: true },
  { id: 'lesson_start', method: 'POST', path: '/api/lesson/start', requiresAuth: true },
  { id: 'lesson_complete', method: 'POST', path: '/api/lesson/complete', requiresAuth: true },
  { id: 'quiz_start', method: 'POST', path: '/api/quiz/start', requiresAuth: true },
  { id: 'quiz_submit', method: 'POST', path: '/api/quiz/submit', requiresAuth: true },
  { id: 'assessment_start', method: 'POST', path: '/api/assessment/start', requiresAuth: true },
  { id: 'assessment_submit', method: 'POST', path: '/api/assessment/submit', requiresAuth: true },
  { id: 'capstone_review', method: 'POST', path: '/api/capstone/review', requiresAuth: true },
  { id: 'bare_act_analyse', method: 'POST', path: '/api/bare-act/analyse', requiresAuth: true },
  { id: 'documents_upload', method: 'POST', path: '/api/documents/upload', requiresAuth: true },
  { id: 'student_progress', method: 'GET', path: '/api/student/progress', requiresAuth: true },
  { id: 'student_mastery', method: 'GET', path: '/api/student/mastery', requiresAuth: true },
  { id: 'student_projects', method: 'GET', path: '/api/student/projects', requiresAuth: true },
  { id: 'student_history', method: 'GET', path: '/api/student/history', requiresAuth: true },
  { id: 'pattern_detail', method: 'GET', path: '/api/patterns/:id', requiresAuth: true },
  { id: 'lesson_detail', method: 'GET', path: '/api/lessons/:id', requiresAuth: true },
  { id: 'module_detail', method: 'GET', path: '/api/modules/:id', requiresAuth: true },
];

export function getRoute(id: ApiRouteDefinition['id']): ApiRouteDefinition {
  const route = routeDefinitions.find((candidate) => candidate.id === id);
  if (!route) throw new Error(`Route not registered: ${id}`);
  return route;
}

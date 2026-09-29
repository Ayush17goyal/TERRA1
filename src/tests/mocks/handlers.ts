import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('/api/documents/upload', async () => HttpResponse.json({ data: { documentId: 'doc-uploaded' } })),
  http.post('/api/bare-act/analyse', async () => HttpResponse.json({ text: 'Learning objective: analyse Bare Act structure. Next action: inspect extracted components.' })),
  http.get('/api/student/progress', () => HttpResponse.json({ overallProgress: 42 })),
  http.get('/api/student/mastery', () => HttpResponse.json({ percentage: 64 })),
  http.get('/api/student/projects', () => HttpResponse.json({ active: { title: 'Test Drafting Project' } })),
  http.get('/api/student/history', () => HttpResponse.json({ recent: ['Reviewed definitions clause'] })),
];

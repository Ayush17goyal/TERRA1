import { insertSupabase, localLexMentorReply, readBody, sendJson } from '../../_utils.js';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return sendJson(res, 204, null);
  if (req.method !== 'POST') return sendJson(res, 405, { message: 'Method not allowed' });
  const body = await readBody(req);
  const sessionId = body.sessionId || `session_${Math.random().toString(36).slice(2, 11)}`;
  const messageId = `msg_${Math.random().toString(36).slice(2, 11)}`;
  const content = localLexMentorReply(String(body.message || ''), String(body.depth || 'Intermediate'));
  await insertSupabase('user_activity_logs', {
    user_id: 'production-user',
    module: 'LexMentor AI',
    action: 'Asked Question',
    module_name: 'LexMentor AI',
    action_type: 'Asked Question',
    session_id: sessionId,
    created_at: new Date().toISOString(),
  });
  return sendJson(res, 200, { sessionId, messageId, content, citations: [], provider: 'vercel-compat', model: 'local-production-fallback' });
}

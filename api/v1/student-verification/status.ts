import { sendJson } from '../../_utils.js';

export default function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return sendJson(res, 204, null);
  if (req.method !== 'GET') return sendJson(res, 405, { message: 'Method not allowed' });
  return sendJson(res, 200, { status: 'Not Submitted', request: null });
}

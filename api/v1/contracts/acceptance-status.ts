import { defaultContractVersion, getBearerSubject, selectSupabase, sendJson } from '../../_utils.js';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

  const userId = getBearerSubject(req);
  if (!userId) return sendJson(res, 200, { accepted: false });

  const version = req.query?.contractVersion || defaultContractVersion;
  const query = `select=id&user_id=eq.${encodeURIComponent(userId)}&contract_version=eq.${encodeURIComponent(version)}&accepted=eq.true&limit=1`;
  const db = await selectSupabase('contract_acceptances', query);
  return sendJson(res, 200, { accepted: Array.isArray(db.data) && db.data.length > 0 });
}
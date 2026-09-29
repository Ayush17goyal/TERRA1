import { defaultContractVersion, getBearerSubject, insertSupabase, readBody, sendJson } from '../../_utils.js';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  const body = await readBody(req);
  const userId = getBearerSubject(req) || body.userId || 'anonymous-production-user';
  const contractVersion = body.contractVersion || defaultContractVersion;
  const ipAddress = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0] || null;
  const userAgent = req.headers?.['user-agent'] || null;
  const acceptedAt = new Date().toISOString();

  const contractInsert = await insertSupabase('contract_acceptances', {
    user_id: userId,
    email: body.email || null,
    ip_address: ipAddress,
    browser_user_agent: userAgent,
    contract_version: contractVersion,
    accepted: true,
    timestamp: acceptedAt,
  });

  if (contractInsert.ok) {
    return sendJson(res, 200, {
      success: true,
      accepted: true,
      contractVersion,
      storage: 'contract_acceptances',
      acceptance: Array.isArray(contractInsert.data) ? contractInsert.data[0] : contractInsert.data,
    });
  }

  const fallbackInsert = await insertSupabase('user_activity_logs', {
    user_id: userId,
    module: 'IP & Contract Compliance',
    action: 'Accepted Contract',
    module_name: 'IP & Contract Compliance',
    action_type: 'Accepted Contract',
    session_id: body.sessionId || null,
    metadata: {
      contractVersion,
      email: body.email || null,
      ipAddress,
      userAgent,
      accepted: true,
      acceptedAt,
      primaryInsertError: contractInsert,
    },
    created_at: acceptedAt,
  });

  if (!fallbackInsert.ok) {
    return sendJson(res, 502, {
      success: false,
      error: 'Contract acceptance insert failed',
      contractInsert,
      fallbackInsert,
    });
  }

  return sendJson(res, 200, {
    success: true,
    accepted: true,
    contractVersion,
    storage: 'user_activity_logs',
    acceptance: Array.isArray(fallbackInsert.data) ? fallbackInsert.data[0] : fallbackInsert.data,
  });
}
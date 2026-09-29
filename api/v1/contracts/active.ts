import { defaultContractContent, defaultContractVersion, selectSupabase, sendJson } from '../../_utils.js';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

  const db = await selectSupabase(
    'contract_configs',
    'select=id,contract_version,contract_content,last_updated&order=last_updated.desc&limit=1'
  );

  const row = Array.isArray(db.data) ? db.data[0] : null;
  return sendJson(res, 200, {
    id: row?.id || null,
    contractVersion: row?.contract_version || defaultContractVersion,
    contractContent: row?.contract_content || defaultContractContent,
    lastUpdated: row?.last_updated || new Date().toISOString(),
  });
}
import { defaultContractContent, defaultContractVersion } from '../../_utils.js';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.status(200).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const text = `LEGATRIXON\nINTELLECTUAL PROPERTY & ELECTRONIC CONTRACT\nVersion: ${defaultContractVersion}\n\n${defaultContractContent}`;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="LEGATRIXON_Contract_v${defaultContractVersion}.txt"`);
  res.status(200).send(text);
}
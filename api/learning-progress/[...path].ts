import v1Handler from '../v1/[...path].js';

export default async function handler(req: any, res: any) {
  const value = req.query?.path;
  const suffix = Array.isArray(value) ? value.join('/') : String(value || 'dashboard');
  req.query = { ...(req.query || {}), path: `learning-progress/${suffix}` };
  return v1Handler(req, res);
}
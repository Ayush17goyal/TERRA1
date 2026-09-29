declare const process: any;
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://mydrikssmzzudzqeqroe.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

async function checkSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return { status: 'unconfigured' };
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/users?select=id&limit=1`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    });

    return {
      status: response.ok ? 'healthy' : 'unhealthy',
      httpStatus: response.status,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Supabase check failed',
    };
  }
}

export default async function handler(_req: any, res: any) {
  const supabase = await checkSupabase();
  const healthy = supabase.status === 'healthy';

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    runtime: 'vercel',
    details: {
      api: 'healthy',
      supabase,
    },
  });
}

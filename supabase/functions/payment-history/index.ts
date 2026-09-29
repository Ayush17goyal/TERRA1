// Supabase Edge Function: payment-history
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

// Helper to extract and verify Clerk user ID from JWT
function getClerkUserId(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payloadRaw = parts[1];
    const base64 = payloadRaw.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64);
    const payload = JSON.parse(decoded);

    if (payload.exp && Date.now() / 1000 > payload.exp) {
      console.error('Clerk JWT is expired');
      return null;
    }

    return payload.sub || null;
  } catch (err) {
    console.error('Failed to parse Clerk JWT:', err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const clerkUserId = getClerkUserId(authHeader)

    if (!clerkUserId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or missing authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Only ever return the authenticated user's own records
    const { data, error } = await supabase
      .from('payments')
      .select('id, user_id, order_id, payment_id, plan_id, amount, currency, status, method, invoice_number, created_at, updated_at')
      .eq('user_id', clerkUserId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching payment history:', error)
      return new Response(
        JSON.stringify({ error: 'Internal Server Error: Failed to fetch payment history' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify(data || []),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error in payment-history function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

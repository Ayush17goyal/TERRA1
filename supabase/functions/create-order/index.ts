// Supabase Edge Function: create-order
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    
    // Check expiration
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

// Server-side source of truth for plan pricing (INR).
// Client-supplied amount is ignored to prevent price tampering.
const PLAN_PRICES: Record<string, number> = {
  starter: 199,
  pro: 399,
  'pro-max': 599,
}

Deno.serve(async (req) => {
  // CORS Preflight
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

    const { plan_id, user_id } = await req.json()

    // Validate request parameters
    if (!plan_id || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Bad Request: Missing required parameters plan_id or user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Ensure the authenticated user matches the requested user ID
    if (clerkUserId !== user_id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: You can only create orders for your own account' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Never trust a client-supplied amount — resolve the price from the server-side plan map
    const amount = PLAN_PRICES[plan_id]
    if (!amount) {
      return new Response(
        JSON.stringify({ error: 'Bad Request: Unknown plan_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Retrieve Razorpay keys from environment variables
    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!keySecret) {
      console.error('RAZORPAY_KEY_SECRET is not configured inside Supabase secrets');
      return new Response(
        JSON.stringify({ error: 'Internal Server Error: Razorpay secrets not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Amount in paise (Razorpay standard)
    const amountInPaise = Math.round(amount * 100)
    const currency = 'INR'
    const receipt = `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`

    // Call Razorpay Order API
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${keyId}:${keySecret}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency,
        receipt,
        notes: {
          user_id,
          plan_id,
        },
      }),
    })

    const orderData = await response.json()

    if (!response.ok) {
      console.error('Razorpay API error:', orderData)
      return new Response(
        JSON.stringify({ error: 'Razorpay API failure', details: orderData }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        order_id: orderData.id,
        key_id: keyId,
        amount: orderData.amount,
        currency: orderData.currency,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error creating Razorpay order:', error)
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

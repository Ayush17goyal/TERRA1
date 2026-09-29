// Supabase Edge Function: verify-payment
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

// Verify HMAC-SHA256 signature
async function verifySignature(orderId: string, paymentId: string, signature: string, secret: string): Promise<boolean> {
  try {
    const text = `${orderId}|${paymentId}`
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const messageData = encoder.encode(text)

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
    const signatureArray = Array.from(new Uint8Array(signatureBuffer))
    const generatedSignature = signatureArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    return generatedSignature === signature
  } catch (err) {
    console.error('HMAC Signature verification failed:', err)
    return false
  }
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
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { payment_id, order_id, signature, user_id, plan_id } = await req.json()

    // Validate inputs
    if (!payment_id || !order_id || !signature || !user_id || !plan_id) {
      return new Response(
        JSON.stringify({ error: 'Bad Request: Missing payment_id, order_id, signature, user_id, or plan_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Ensure the authenticated user matches the requested user ID
    if (clerkUserId !== user_id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: You cannot perform updates for another account' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Retrieve Razorpay credentials
    const keyId = Deno.env.get('RAZORPAY_KEY_ID') || 'rzp_test_T8FJFRwicSO3TC';
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!keySecret) {
      return new Response(
        JSON.stringify({ error: 'Internal Server Error: Razorpay secret not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify signature
    const isValidSignature = await verifySignature(order_id, payment_id, signature, keySecret)
    if (!isValidSignature) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch the order from Razorpay to recover the plan_id/user_id it was actually
    // created for. The client-submitted plan_id is never trusted on its own — otherwise
    // a user could pay for a cheap plan and claim a higher tier in this call.
    const orderResponse = await fetch(`https://api.razorpay.com/v1/orders/${order_id}`, {
      headers: { 'Authorization': `Basic ${btoa(`${keyId}:${keySecret}`)}` }
    })

    if (!orderResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Bad Request: Could not verify order with Razorpay' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const orderData = await orderResponse.json()
    const orderUserId = orderData.notes?.user_id
    const orderPlanId = orderData.notes?.plan_id

    if (orderUserId !== user_id || orderPlanId !== plan_id) {
      console.error(`Order/plan mismatch: order notes (${orderUserId}, ${orderPlanId}) vs request (${user_id}, ${plan_id})`)
      return new Response(
        JSON.stringify({ error: 'Forbidden: Order does not match the requesting user or plan' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch details of payment from Razorpay API to prevent replay/tampering attacks
    let paymentMethod = 'unknown'
    let finalAmount = 0
    let finalCurrency = 'INR'

    try {
      const payResponse = await fetch(`https://api.razorpay.com/v1/payments/${payment_id}`, {
        headers: {
          'Authorization': `Basic ${btoa(`${keyId}:${keySecret}`)}`,
        }
      })
      if (payResponse.ok) {
        const payData = await payResponse.json()
        if (payData.order_id !== order_id) {
          return new Response(
            JSON.stringify({ error: 'Bad Request: Payment does not belong to the given order' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        paymentMethod = payData.method || paymentMethod
        finalAmount = (payData.amount || 0) / 100 // convert paise to INR
        finalCurrency = payData.currency || finalCurrency
      } else {
        console.warn('Could not fetch payment details from Razorpay, falling back to database defaults')
      }
    } catch (e) {
      console.warn('Failed connecting to Razorpay API for verification details:', e)
    }

    // Initialize Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if the payment already exists to prevent duplicate entries
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('payment_id', payment_id)
      .maybeSingle()

    if (existingPayment) {
      return new Response(
        JSON.stringify({ error: 'Conflict: Payment already processed and recorded' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate Invoice Number
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`
    
    // 1. Save record in payments table
    const { error: payError } = await supabase
      .from('payments')
      .insert({
        user_id,
        order_id,
        payment_id,
        plan_id,
        amount: finalAmount || 0,
        currency: finalCurrency,
        status: 'captured',
        method: paymentMethod,
        invoice_number: invoiceNumber,
      })

    if (payError) {
      console.error('Error saving payment record:', payError)
      throw new Error(`Database error saving payment details: ${payError.message}`)
    }

    // Calculate dates
    const startDate = new Date()
    const expiryDate = new Date()
    expiryDate.setDate(startDate.getDate() + 30) // 30 days billing cycle

    if (plan_id === 'API Credit') {
      // 2. Buy API credits: increment the ai_credits_limit by 5000 (stackable) in user_subscriptions
      const { data: currentSub } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user_id)
        .maybeSingle()

      if (currentSub) {
        const newLimit = (currentSub.ai_credits_limit || 0) + 5000
        const { error: subUpdateError } = await supabase
          .from('user_subscriptions')
          .update({
            ai_credits_limit: newLimit,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user_id)

        if (subUpdateError) console.error('Error updating user_subscriptions credits limit:', subUpdateError)
      } else {
        // Create new user_subscriptions for this user if somehow missing
        await supabase
          .from('user_subscriptions')
          .insert({
            user_id,
            plan_name: 'Scholar',
            status: 'active',
            ai_credits_limit: 6000, // 1000 default + 5000 booster
            ai_credits_used: 0,
          })
      }
    } else {
      // 3. For subscriptions (Basic Plan, Pro Plan, Pro Max Plan):
      // Update public.subscriptions table (requested by instructions)
      const { error: subTableError } = await supabase
        .from('subscriptions')
        .upsert({
          user_id,
          plan: plan_id,
          status: 'active',
          start_date: startDate.toISOString(),
          expiry_date: expiryDate.toISOString(),
          payment_id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      if (subTableError) {
        console.error('Error upserting subscriptions table:', subTableError)
      }

      // Update public.user_subscriptions table (used by settings/nestjs backend)
      let aiCreditsLimit = 1000 // default fallback
      if (plan_id === 'Basic Plan') {
        aiCreditsLimit = 2000
      } else if (plan_id === 'Pro Plan') {
        aiCreditsLimit = 5000
      } else if (plan_id === 'Pro Max Plan') {
        aiCreditsLimit = 15000
      }

      const { error: userSubError } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id,
          plan_name: plan_id,
          status: 'active',
          renewal_date: expiryDate.toISOString(),
          ai_credits_limit: aiCreditsLimit,
          ai_credits_used: 0, // Reset usage for the billing cycle
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      if (userSubError) {
        console.error('Error upserting user_subscriptions table:', userSubError)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        invoice_number: invoiceNumber,
        amount: finalAmount,
        currency: finalCurrency,
        payment_id,
        order_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error verifying Razorpay payment:', error)
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

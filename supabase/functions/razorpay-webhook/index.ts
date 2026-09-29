// Supabase Edge Function: razorpay-webhook
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-razorpay-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Verify webhook signature
async function verifyWebhookSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const messageData = encoder.encode(rawBody)

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
    console.error('Webhook signature verification error:', err)
    return false
  }
}

Deno.serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const signature = req.headers.get('X-Razorpay-Signature') || req.headers.get('x-razorpay-signature')
    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing webhook signature' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rawBody = await req.text()
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')

    if (!webhookSecret) {
      console.error('RAZORPAY_WEBHOOK_SECRET is not configured inside Supabase secrets')
      return new Response(JSON.stringify({ error: 'Internal configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify signature
    const isValid = await verifyWebhookSignature(rawBody, signature, webhookSecret)
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const eventData = JSON.parse(rawBody)
    const event = eventData.event
    console.log(`Received Razorpay webhook event: ${event}`)

    // Initialize Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Handle events
    if (event === 'payment.captured' || event === 'order.paid' || event === 'subscription.charged') {
      const paymentEntity = eventData.payload.payment?.entity || eventData.payload.order?.entity
      if (!paymentEntity) {
        return new Response(JSON.stringify({ error: 'Invalid payload structure' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const paymentId = paymentEntity.id
      const orderId = paymentEntity.order_id
      const amount = (paymentEntity.amount || 0) / 100 // convert paise to INR
      const currency = paymentEntity.currency || 'INR'
      const method = paymentEntity.method || 'unknown'
      
      // Extract notes from metadata
      const userId = paymentEntity.notes?.user_id
      const planId = paymentEntity.notes?.plan_id

      if (!userId || !planId) {
        console.warn(`Webhook received for payment ${paymentId} without user_id or plan_id in notes. Skipping db updates.`);
        return new Response(JSON.stringify({ message: 'Skipped: missing metadata notes' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Check if payment already recorded
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id')
        .eq('payment_id', paymentId)
        .maybeSingle()

      if (!existingPayment) {
        const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`
        
        // Save the payment
        await supabase
          .from('payments')
          .insert({
            user_id: userId,
            order_id: orderId,
            payment_id: paymentId,
            plan_id: planId,
            amount,
            currency,
            status: 'captured',
            method,
            invoice_number: invoiceNumber,
          })
      }

      // Activate subscription / stack credits if not already done
      const startDate = new Date()
      const expiryDate = new Date()
      expiryDate.setDate(startDate.getDate() + 30)

      if (planId === 'API Credit') {
        const { data: currentSub } = await supabase
          .from('user_subscriptions')
          .select('ai_credits_limit')
          .eq('user_id', userId)
          .maybeSingle()

        if (currentSub) {
          const newLimit = (currentSub.ai_credits_limit || 0) + 5000
          await supabase
            .from('user_subscriptions')
            .update({ ai_credits_limit: newLimit, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
        } else {
          await supabase
            .from('user_subscriptions')
            .insert({
              user_id: userId,
              plan_name: 'Scholar',
              status: 'active',
              ai_credits_limit: 6000,
              ai_credits_used: 0,
            })
        }
      } else {
        // Upsert subscription
        await supabase
          .from('subscriptions')
          .upsert({
            user_id: userId,
            plan: planId,
            status: 'active',
            start_date: startDate.toISOString(),
            expiry_date: expiryDate.toISOString(),
            payment_id: paymentId,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })

        // Update settings subscription credits
        let aiCreditsLimit = 1000
        if (planId === 'Basic Plan') {
          aiCreditsLimit = 2000
        } else if (planId === 'Pro Plan') {
          aiCreditsLimit = 5000
        } else if (planId === 'Pro Max Plan') {
          aiCreditsLimit = 15000
        }

        await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: userId,
            plan_name: planId,
            status: 'active',
            renewal_date: expiryDate.toISOString(),
            ai_credits_limit: aiCreditsLimit,
            ai_credits_used: 0,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })
      }
    } else if (event === 'payment.failed') {
      const paymentEntity = eventData.payload.payment.entity
      const paymentId = paymentEntity.id
      const orderId = paymentEntity.order_id
      const amount = (paymentEntity.amount || 0) / 100
      const currency = paymentEntity.currency || 'INR'
      const userId = paymentEntity.notes?.user_id
      const planId = paymentEntity.notes?.plan_id
      const errorDescription = paymentEntity.error_description || 'Payment Failed'

      if (userId && planId) {
        // Insert failed payment record
        await supabase
          .from('payments')
          .insert({
            user_id: userId,
            order_id: orderId,
            payment_id: paymentId,
            plan_id: planId,
            amount,
            currency,
            status: 'failed',
            method: paymentEntity.method || 'unknown',
            invoice_number: `FAILED-${Date.now().toString().slice(-6)}`,
          })
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Webhook error:', error)
    return new Response(JSON.stringify({ error: 'Webhook processing failed', message: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

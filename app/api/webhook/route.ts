import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { verifyWebhookSignature, isRazorpayConfigured } from '@/lib/razorpay/server';
import { recordAudit } from '@/lib/audit/logger';

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-razorpay-signature') || '';

    // Verify webhook signature if Razorpay is configured
    if (isRazorpayConfigured() && signature) {
      const valid = verifyWebhookSignature(body, signature);
      if (!valid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const event = JSON.parse(body);
    const eventId = event.event_id || event.id || crypto.randomUUID();
    const eventType = event.event || 'unknown';
    const payload = event;

    const supabase = createServerClient();
    const { data: business } = await supabase.from('businesses').select('id').limit(1).maybeSingle();
    if (!business) {
      return NextResponse.json({ error: 'No business configured' }, { status: 500 });
    }

    // Idempotency check
    const { data: existing } = await supabase
      .from('webhook_events')
      .select('id, processed')
      .eq('event_id', eventId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ message: 'Event already processed', event_id: eventId });
    }

    // Store webhook event
    const entityType = payload.payload?.payment?.entity ? 'payment' :
      payload.payload?.order?.entity ? 'order' :
      payload.payload?.subscription?.entity ? 'subscription' : 'unknown';
    const entityId = payload.payload?.payment?.entity?.id ||
      payload.payload?.order?.entity?.id ||
      payload.payload?.subscription?.entity?.id || null;

    await supabase.from('webhook_events').insert({
      event_id: eventId,
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      payload,
      processed: false,
    });

    // Process event
    await processWebhookEvent(supabase, business.id, eventType, payload);

    // Mark as processed
    await supabase.from('webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('event_id', eventId);

    await recordAudit({
      business_id: business.id,
      category: 'webhook',
      event: `Webhook received: ${eventType}`,
      details: { event_id: eventId, entity_type: entityType, entity_id: entityId },
    });

    return NextResponse.json({ received: true, event_id: eventId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function processWebhookEvent(
  supabase: ReturnType<typeof createServerClient>,
  businessId: string,
  eventType: string,
  payload: Record<string, unknown>
) {
  const paymentEntity = (payload as { payload?: { payment?: { entity?: Record<string, unknown> } } })?.payload?.payment?.entity;
  const orderEntity = (payload as { payload?: { order?: { entity?: Record<string, unknown> } } })?.payload?.order?.entity;

  if (eventType.includes('payment.captured') || eventType.includes('payment.authorized')) {
    if (paymentEntity) {
      const paymentId = paymentEntity.id as string;
      const amount = (paymentEntity.amount as number) / 100;
      const status = paymentEntity.status as string;

      // Update payment record if exists
      await supabase.from('payments')
        .update({ status, razorpay_payment_id: paymentId })
        .eq('razorpay_payment_id', paymentId)
        .maybeSingle();

      await recordAudit({
        business_id: businessId,
        category: 'result',
        event: `Payment ${status}: ${paymentId}`,
        details: { payment_id: paymentId, amount, status },
        revenue_impact: amount,
      });
    }
  } else if (eventType.includes('payment.failed')) {
    if (paymentEntity) {
      const paymentId = paymentEntity.id as string;
      const errorCode = paymentEntity.error_code as string;
      const errorDesc = paymentEntity.error_description as string;

      await recordAudit({
        business_id: businessId,
        category: 'error',
        event: `Payment failed: ${paymentId}`,
        details: { payment_id: paymentId, error_code: errorCode, error_description: errorDesc },
      });
    }
  } else if (eventType.includes('order.paid')) {
    if (orderEntity) {
      const orderId = orderEntity.id as string;
      const amount = (orderEntity.amount as number) / 100;

      await recordAudit({
        business_id: businessId,
        category: 'result',
        event: `Order paid: ${orderId}`,
        details: { order_id: orderId, amount },
        revenue_impact: amount,
      });
    }
  }
}

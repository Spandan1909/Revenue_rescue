import { createServerClient } from '@/lib/supabase/server';
import { gatherEvidence } from '@/lib/risk/analyzer';
import { recordAudit } from '@/lib/audit/logger';
import type { Customer, Payment, Order, Subscription } from '@/lib/types';

export interface CampaignInput {
  customerId: string;
  businessId: string;
}

export interface GeneratedCampaign {
  message: string;
  reason: string;
  expectedOutcome: string;
  channel: string;
}

export async function generateRecoveryCampaign(input: CampaignInput): Promise<GeneratedCampaign> {
  const supabase = createServerClient();

  const { data: customerData } = await supabase
    .from('customers')
    .select('*')
    .eq('id', input.customerId)
    .maybeSingle();
  const customer = customerData as Customer | null;
  if (!customer) throw new Error('Customer not found');

  const { data: paymentData } = await supabase
    .from('payments')
    .select('*')
    .eq('customer_id', input.customerId)
    .order('created_at', { ascending: false });
  const payments = (paymentData || []) as Payment[];

  const { data: orderData } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_id', input.customerId)
    .order('created_at', { ascending: false });
  const orders = (orderData || []) as Order[];

  const { data: subData } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('customer_id', input.customerId);
  const subscriptions = (subData || []) as Subscription[];

  const { data: riskData } = await supabase
    .from('revenue_risks')
    .select('*')
    .eq('customer_id', input.customerId)
    .in('status', ['open', 'investigating', 'action_pending'])
    .order('detected_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const evidence = gatherEvidence({ customer, payments, orders, subscriptions });
  const firstName = customer.name.split(' ')[0];
  const atRiskAmount = riskData?.amount || 0;
  const riskType = riskData?.risk_type || 'inactive_customer';

  let message = '';
  let reason = '';
  let expectedOutcome = '';

  switch (riskType) {
    case 'failed_payment':
      message = `Hi ${firstName}, we noticed your recent payment of ₹${atRiskAmount.toLocaleString('en-IN')} didn't go through. No worries — click here to complete your order with a different payment method. Your cart is still saved!`;
      reason = 'Customer has a recent failed payment but a history of successful payments. A direct payment link with a friendly tone is most likely to convert.';
      expectedOutcome = '60-70% probability of recovery based on customer payment history and active status.';
      break;

    case 'abandoned_checkout':
      message = `Hi ${firstName}, you left something behind! Your items are still in your cart. Complete your order now and get free shipping on us. Tap here to checkout in seconds.`;
      reason = 'Customer abandoned checkout recently. A reminder with a small incentive (free shipping) addresses the most common abandonment reason without a deep discount.';
      expectedOutcome = '40-50% probability of checkout completion with a reminder.';
      break;

    case 'inactive_customer':
      if (evidence.daysSinceLastPayment && evidence.daysSinceLastPayment > 90) {
        message = `Hi ${firstName}, we miss you! It's been a while since your last visit. Here's 15% off your next order as a welcome-back gift. Use code WELCOME15 at checkout.`;
        reason = 'Customer has been inactive for over 90 days. A re-engagement offer is warranted — the incentive is modest (15%) to avoid unnecessary discounting while maximizing re-engagement.';
        expectedOutcome = '25-35% probability of re-engagement with a targeted offer.';
      } else {
        message = `Hi ${firstName}, we noticed you haven't shopped with us recently. Your favorite items are back in stock! Tap here to browse and pick up where you left off.`;
        reason = 'Customer has been inactive for a moderate period. A gentle reminder without a discount is appropriate to test re-engagement before offering incentives.';
        expectedOutcome = '30-40% probability of re-engagement with a non-discount reminder.';
      }
      break;

    case 'subscription_failure':
      message = `Hi ${firstName}, your ${riskData?.reason?.includes('subscription') ? 'subscription' : 'plan'} renewal payment didn't complete. Please update your payment method to keep your subscription active. Click here to update and resume — no interruption needed.`;
      reason = 'Subscription renewal failed, likely due to an expired payment method. A clear call-to-action to update payment info is the most direct path to recovery.';
      expectedOutcome = '55-65% probability of subscription recovery with a payment update prompt.';
      break;

    default:
      message = `Hi ${firstName}, we'd love to have you back! Click here to see what's new at ShopNest.`;
      reason = 'General re-engagement message for inactive customer.';
      expectedOutcome = '20-30% probability of re-engagement.';
  }

  return {
    message,
    reason,
    expectedOutcome,
    channel: 'email',
  };
}

export async function saveCampaign(
  customerId: string,
  businessId: string,
  campaign: GeneratedCampaign,
  revenueRiskId?: string
): Promise<{ id: string }> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      business_id: businessId,
      customer_id: customerId,
      revenue_risk_id: revenueRiskId || null,
      message: campaign.message,
      channel: campaign.channel,
      reason: campaign.reason,
      expected_outcome: campaign.expectedOutcome,
      status: 'pending_approval',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save campaign: ${error.message}`);

  await recordAudit({
    business_id: businessId,
    customer_id: customerId,
    revenue_risk_id: revenueRiskId || null,
    category: 'decision',
    event: 'AI campaign generated',
    details: {
      message: campaign.message,
      channel: campaign.channel,
      reason: campaign.reason,
    },
  });

  return { id: (data as { id: string }).id };
}

export async function sendCampaign(campaignId: string, businessId: string): Promise<void> {
  const supabase = createServerClient();

  await supabase
    .from('campaigns')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', campaignId);

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('customer_id, message, channel')
    .eq('id', campaignId)
    .maybeSingle();

  await recordAudit({
    business_id: businessId,
    customer_id: campaign?.customer_id || null,
    category: 'action',
    event: `Recovery campaign sent (simulated)`,
    details: { campaign_id: campaignId, channel: campaign?.channel, message: campaign?.message },
    metadata: { simulated: true, tool: 'send_recovery_message' },
  });
}

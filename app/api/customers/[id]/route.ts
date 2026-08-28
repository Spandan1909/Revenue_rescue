import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { gatherEvidence, calculateRiskScore, riskLevelFromScore, diagnoseReason } from '@/lib/risk/analyzer';
import { recommendRecoveryAction } from '@/lib/recovery/decision';
import type { Customer, Payment, Order, Subscription, RevenueRisk } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();

  const { data: customerData } = await supabase
    .from('customers')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();
  const customer = customerData as Customer | null;

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  const [paymentsRes, ordersRes, subsRes, risksRes, actionsRes, auditRes] = await Promise.all([
    supabase.from('payments').select('*').eq('customer_id', params.id).order('created_at', { ascending: false }),
    supabase.from('orders').select('*').eq('customer_id', params.id).order('created_at', { ascending: false }),
    supabase.from('subscriptions').select('*').eq('customer_id', params.id).order('created_at', { ascending: false }),
    supabase.from('revenue_risks').select('*').eq('customer_id', params.id).order('detected_at', { ascending: false }),
    supabase.from('agent_actions').select('*').eq('customer_id', params.id).order('created_at', { ascending: false }),
    supabase.from('audit_logs').select('*').eq('customer_id', params.id).order('timestamp', { ascending: false }).limit(20),
  ]);

  const payments = (paymentsRes.data || []) as Payment[];
  const orders = (ordersRes.data || []) as Order[];
  const subscriptions = (subsRes.data || []) as Subscription[];
  const risks = (risksRes.data || []) as RevenueRisk[];

  // Compute AI assessment
  let assessment = null;
  const openRisk = risks.find((r) => r.status !== 'recovered' && r.status !== 'lost');
  if (openRisk) {
    const evidence = gatherEvidence({ customer, payments, orders, subscriptions });
    const riskScore = calculateRiskScore(evidence, openRisk.risk_type, openRisk.amount);
    const reason = diagnoseReason(evidence, openRisk.risk_type);
    const decision = recommendRecoveryAction(evidence, openRisk.risk_type, openRisk.amount, riskScore, {
      auto_retry: false,
      auto_payment_link: false,
      human_approval_required: true,
      max_auto_recovery_amount: 2000,
      max_retry_attempts: 3,
      confidence_threshold: 65,
    });

    assessment = {
      riskScore,
      riskLevel: riskLevelFromScore(riskScore),
      reason,
      confidence: decision.confidence,
      explanation: decision.explanation,
      potentialDownside: decision.potentialDownside,
      expectedRecovery: decision.expectedRecovery,
      evidence: {
        lastSuccessfulPayment: evidence.lastSuccessfulPayment,
        previousFailures: evidence.previousFailures,
        avgPaymentIntervalDays: evidence.avgPaymentIntervalDays,
        customerStatus: evidence.customerStatus,
        daysSinceLastPayment: evidence.daysSinceLastPayment,
      },
    };
  }

  return NextResponse.json({
    customer,
    payments,
    orders,
    subscriptions,
    risks,
    actions: actionsRes.data || [],
    audit: auditRes.data || [],
    assessment,
  });
}

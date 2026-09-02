import type { Customer, Payment, Order, Subscription } from '@/lib/types';

export interface RiskInput {
  customer: Customer;
  payments: Payment[];
  orders: Order[];
  subscriptions: Subscription[];
}

export interface RiskEvidence {
  lastSuccessfulPayment: string | null;
  previousFailures: number;
  avgPaymentIntervalDays: number | null;
  customerStatus: string;
  daysSinceLastPayment: number | null;
  totalLifetimeValue: number;
  failedPaymentCount: number;
  abandonedCheckoutCount: number;
  activeSubscriptions: number;
  failedSubscriptions: number;
}

export function calculateDaysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function gatherEvidence(input: RiskInput): RiskEvidence {
  const { customer, payments, orders, subscriptions } = input;

  const successfulPayments = payments.filter((p) => p.status === 'captured' || p.status === 'authorized');
  const failedPayments = payments.filter((p) => p.status === 'failed');
  const lastSuccessful = successfulPayments.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];

  const abandonedCheckouts = orders.filter((o) => o.status === 'abandoned');
  const activeSubs = subscriptions.filter((s) => s.status === 'active');
  const failedSubs = subscriptions.filter((s) => s.status === 'failed' || s.status === 'pending');

  return {
    lastSuccessfulPayment: lastSuccessful?.created_at || null,
    previousFailures: failedPayments.length,
    avgPaymentIntervalDays: customer.avg_payment_interval_days,
    customerStatus: customer.status,
    daysSinceLastPayment: calculateDaysSince(lastSuccessful?.created_at || customer.last_payment_at),
    totalLifetimeValue: customer.lifetime_value,
    failedPaymentCount: failedPayments.length,
    abandonedCheckoutCount: abandonedCheckouts.length,
    activeSubscriptions: activeSubs.length,
    failedSubscriptions: failedSubs.length,
  };
}

export function calculateRiskScore(
  evidence: RiskEvidence,
  riskType: string,
  atRiskAmount: number
): number {
  let score = 0;

  // Days since last payment — longer = higher risk
  if (evidence.daysSinceLastPayment !== null) {
    if (evidence.daysSinceLastPayment > 60) score += 35;
    else if (evidence.daysSinceLastPayment > 30) score += 25;
    else if (evidence.daysSinceLastPayment > 14) score += 15;
    else score += 5;
  }

  // Previous failures
  if (evidence.previousFailures >= 3) score += 25;
  else if (evidence.previousFailures >= 2) score += 18;
  else if (evidence.previousFailures >= 1) score += 10;

  // Customer status
  if (evidence.customerStatus === 'churned') score += 20;
  else if (evidence.customerStatus === 'inactive') score += 15;
  else score += 5;

  // Lifetime value — higher LTV = more worth recovering but also higher risk
  if (evidence.totalLifetimeValue > 50000) score += 10;
  else if (evidence.totalLifetimeValue > 10000) score += 7;
  else score += 3;

  // Risk type modifier
  if (riskType === 'failed_payment') score += 8;
  else if (riskType === 'abandoned_checkout') score += 5;
  else if (riskType === 'inactive_customer') score += 6;
  else if (riskType === 'subscription_failure') score += 7;

  // Amount at risk
  if (atRiskAmount > 10000) score += 5;
  else if (atRiskAmount > 2000) score += 3;

  return Math.min(100, Math.round(score));
}

export function riskLevelFromScore(score: number): 'low' | 'medium' | 'high' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export function diagnoseReason(
  evidence: RiskEvidence,
  riskType: string
): string {
  switch (riskType) {
    case 'failed_payment':
      if (evidence.previousFailures >= 3) {
        return 'Likely cause: repeated payment failure — card may be expired or insufficient balance';
      }
      if (evidence.previousFailures >= 1) {
        return 'Likely cause: payment failure — may be a temporary issue (insufficient balance or network error)';
      }
      return 'Likely cause: single payment failure — appears to be a transient issue';
    case 'abandoned_checkout':
      if (evidence.daysSinceLastPayment !== null && evidence.daysSinceLastPayment > 30) {
        return 'Likely cause: checkout abandonment — customer may have pricing or intent concerns';
      }
      return 'Likely cause: checkout abandonment — customer may have been distracted or had a payment method issue';
    case 'inactive_customer':
      if (evidence.daysSinceLastPayment !== null && evidence.daysSinceLastPayment > 90) {
        return 'Likely cause: customer inactivity — extended absence suggests potential churn';
      }
      return 'Likely cause: customer inactivity — payment cycle may have lapsed';
    case 'subscription_failure':
      if (evidence.failedSubscriptions > 0) {
        return 'Likely cause: subscription renewal failure — payment method may need updating';
      }
      return 'Likely cause: subscription failure — renewal payment did not complete';
    default:
      return 'Likely cause: unknown — insufficient data for definitive diagnosis';
  }
}

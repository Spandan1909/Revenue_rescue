import { createServerClient } from '@/lib/supabase/server';
import type { RecoveryAction } from '@/lib/types';

export interface ActionPerformance {
  action: string;
  totalAttempts: number;
  successfulRecoveries: number;
  recoveryRate: number;
  totalRevenueRecovered: number;
  averageRecoveryAmount: number;
  hasSufficientData: boolean;
}

export interface LearningSummary {
  totalInterventions: number;
  bestAction: string | null;
  bestRecoveryRate: number;
  overallRecoveryRate: number;
  totalRevenueRecovered: number;
  performance: ActionPerformance[];
}

export interface ActionInsight {
  action: string;
  recoveryRate: number;
  totalAttempts: number;
  hasSufficientData: boolean;
}

const MIN_SAMPLES_FOR_CONFIDENCE = 5;

const ACTION_LABELS: Record<string, string> = {
  retry_payment: 'Payment Retry',
  create_payment_link: 'Payment Link',
  send_reminder: 'Reminder',
  escalate_human: 'Escalation',
  offer_recovery_option: 'Recovery Offer',
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] || action;
}

export async function getActionPerformance(
  businessId: string
): Promise<ActionPerformance[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('agent_actions')
    .select(`
      id,
      decision,
      execution_status,
      revenue_recovered,
      created_at,
      executed_at,
      revenue_risks (
        id,
        risk_type,
        amount,
        status,
        detected_at,
        resolved_at
      )
    `)
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  const byAction = new Map<string, {
    attempts: number;
    successes: number;
    recoveredTotal: number;
  }>();

  for (const row of data) {
    const action = row.decision as string | null;
    if (!action) continue;

    const risk = Array.isArray(row.revenue_risks) ? row.revenue_risks[0] : row.revenue_risks;
    const riskStatus = (risk as { status?: string } | undefined)?.status;

    const executed = row.execution_status === 'success';
    const recovered = (row.revenue_recovered ?? 0) > 0;
    const riskResolved = riskStatus === 'recovered';

    const isSuccessful = executed && (recovered || riskResolved);

    const entry = byAction.get(action) || { attempts: 0, successes: 0, recoveredTotal: 0 };
    entry.attempts += 1;
    if (isSuccessful) {
      entry.successes += 1;
      entry.recoveredTotal += row.revenue_recovered || 0;
    }
    byAction.set(action, entry);
  }

  const results: ActionPerformance[] = [];
  for (const [action, stats] of Array.from(byAction)) {
    results.push({
      action,
      totalAttempts: stats.attempts,
      successfulRecoveries: stats.successes,
      recoveryRate: stats.attempts > 0 ? Math.round((stats.successes / stats.attempts) * 100) : 0,
      totalRevenueRecovered: stats.recoveredTotal,
      averageRecoveryAmount: stats.successes > 0 ? Math.round(stats.recoveredTotal / stats.successes) : 0,
      hasSufficientData: stats.attempts >= MIN_SAMPLES_FOR_CONFIDENCE,
    });
  }

  results.sort((a, b) => b.totalAttempts - a.totalAttempts);
  return results;
}

export async function getLearningSummary(
  businessId: string
): Promise<LearningSummary> {
  const performance = await getActionPerformance(businessId);

  const totalInterventions = performance.reduce((s, p) => s + p.totalAttempts, 0);
  const totalSuccesses = performance.reduce((s, p) => s + p.successfulRecoveries, 0);
  const totalRevenueRecovered = performance.reduce((s, p) => s + p.totalRevenueRecovered, 0);

  const withData = performance.filter((p) => p.hasSufficientData);
  const best = withData.length > 0
    ? withData.reduce((best, p) => p.recoveryRate > best.recoveryRate ? p : best)
    : null;

  return {
    totalInterventions,
    bestAction: best?.action ?? null,
    bestRecoveryRate: best?.recoveryRate ?? 0,
    overallRecoveryRate: totalInterventions > 0 ? Math.round((totalSuccesses / totalInterventions) * 100) : 0,
    totalRevenueRecovered,
    performance,
  };
}

export async function getInsightForRiskType(
  businessId: string,
  riskType: string
): Promise<string | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('agent_actions')
    .select(`
      decision,
      execution_status,
      revenue_recovered,
      revenue_risks (
        risk_type,
        status
      )
    `)
    .eq('business_id', businessId);

  if (error || !data) return null;

  const byAction = new Map<string, { attempts: number; successes: number }>();

  for (const row of data) {
    const action = row.decision as string | null;
    if (!action) continue;

    const risk = Array.isArray(row.revenue_risks) ? row.revenue_risks[0] : row.revenue_risks;
    const rowRiskType = (risk as { risk_type?: string } | undefined)?.risk_type;
    if (rowRiskType !== riskType) continue;

    const riskStatus = (risk as { status?: string } | undefined)?.status;
    const executed = row.execution_status === 'success';
    const recovered = (row.revenue_recovered ?? 0) > 0;
    const riskResolved = riskStatus === 'recovered';
    const isSuccessful = executed && (recovered || riskResolved);

    const entry = byAction.get(action) || { attempts: 0, successes: 0 };
    entry.attempts += 1;
    if (isSuccessful) entry.successes += 1;
    byAction.set(action, entry);
  }

  const candidates: ActionInsight[] = [];
  for (const [action, stats] of Array.from(byAction)) {
    if (stats.attempts < MIN_SAMPLES_FOR_CONFIDENCE) continue;
    candidates.push({
      action,
      recoveryRate: Math.round((stats.successes / stats.attempts) * 100),
      totalAttempts: stats.attempts,
      hasSufficientData: true,
    });
  }

  if (candidates.length < 2) return null;

  candidates.sort((a, b) => b.recoveryRate - a.recoveryRate);
  const best = candidates[0];
  const second = candidates[1];

  if (best.recoveryRate <= second.recoveryRate) return null;

  return `${actionLabel(best.action)} is recommended because it has the highest historical recovery rate (${best.recoveryRate}%) for similar ${riskType.replace(/_/g, ' ')} cases, compared with ${second.recoveryRate}% for ${actionLabel(second.action).toLowerCase()}.`;
}

export function shouldPreferHistoricalAction(
  performance: ActionPerformance[],
  riskType: string,
  candidateActions: RecoveryAction[]
): { preferredAction: RecoveryAction | null; insight: string | null } {
  void riskType;
  const withData = performance.filter((p) => p.hasSufficientData && candidateActions.includes(p.action as RecoveryAction));
  if (withData.length < 2) return { preferredAction: null, insight: null };

  withData.sort((a, b) => b.recoveryRate - a.recoveryRate);
  const best = withData[0];
  const second = withData[1];

  if (best.recoveryRate <= second.recoveryRate + 10) return { preferredAction: null, insight: null };

  const insight = `${actionLabel(best.action)} is recommended because it has the highest historical recovery rate (${best.recoveryRate}%) for similar cases, compared with ${second.recoveryRate}% for ${actionLabel(second.action).toLowerCase()}.`;

  return {
    preferredAction: best.action as RecoveryAction,
    insight,
  };
}

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createServerClient();
  const { data: business } = await supabase.from('businesses').select('id').limit(1).maybeSingle();
  if (!business) return NextResponse.json({ analytics: null });

  const [risksRes, actionsRes, paymentsRes, approvalsRes, auditRes] = await Promise.all([
    supabase.from('revenue_risks').select('*').eq('business_id', business.id),
    supabase.from('agent_actions').select('*').eq('business_id', business.id),
    supabase.from('payments').select('*').eq('business_id', business.id),
    supabase.from('approvals').select('*').eq('business_id', business.id),
    supabase.from('audit_logs').select('*').eq('business_id', business.id).order('timestamp', { ascending: false }),
  ]);

  const risks = risksRes.data || [];
  const actions = actionsRes.data || [];
  const payments = paymentsRes.data || [];
  const approvals = approvalsRes.data || [];
  const audit = auditRes.data || [];

  // Revenue recovered
  const recovered = risks.filter((r) => r.status === 'recovered').reduce((s, r) => s + r.amount, 0);
  // Revenue lost
  const lost = risks.filter((r) => r.status === 'lost').reduce((s, r) => s + r.amount, 0);
  // Revenue at risk
  const atRisk = risks.filter((r) => !['recovered', 'lost'].includes(r.status)).reduce((s, r) => s + r.amount, 0);

  // Recovery rate
  const totalAtRisk = recovered + lost + atRisk;
  const recoveryRate = totalAtRisk > 0 ? Math.round((recovered / totalAtRisk) * 100) : 0;

  // Intervention performance
  const interventionTypes = ['retry_payment', 'send_reminder', 'create_payment_link', 'escalate_human'];
  const interventionPerformance = interventionTypes.map((type) => {
    const typeActions = actions.filter((a) => a.decision === type || a.tool_name === type);
    const successful = typeActions.filter((a) => a.execution_status === 'success');
    const recoveryRate = typeActions.length > 0 ? Math.round((successful.length / typeActions.length) * 100) : 0;
    const revenue = successful.reduce((s, a) => s + (a.revenue_recovered || 0), 0);
    return {
      type,
      label: type === 'retry_payment' ? 'Payment Retry' : type === 'send_reminder' ? 'Reminder' : type === 'create_payment_link' ? 'Payment Link' : 'Human Escalation',
      total: typeActions.length,
      successful: successful.length,
      recoveryRate,
      revenue,
    };
  });

  // AI recommendation acceptance rate
  const approvedApprovals = approvals.filter((a) => a.status === 'approved');
  const acceptanceRate = approvals.length > 0 ? Math.round((approvedApprovals.length / approvals.length) * 100) : 0;

  // AI success rate
  const executedActions = actions.filter((a) => a.execution_status === 'success' || a.execution_status === 'failed');
  const successCount = actions.filter((a) => a.execution_status === 'success').length;
  const aiSuccessRate = executedActions.length > 0 ? Math.round((successCount / executedActions.length) * 100) : 0;

  // Failed interventions
  const failedActions = actions.filter((a) => a.execution_status === 'failed');

  // Revenue trend (last 7 days from audit logs)
  const last7Days = [...Array(7)].map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dayStart = new Date(date.setHours(0, 0, 0, 0));
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const dayLogs = audit.filter((l) => {
      const t = new Date(l.timestamp);
      return t >= dayStart && t < dayEnd;
    });
    const recovered = dayLogs.filter((l) => l.category === 'result').reduce((s, l) => s + (l.revenue_impact || 0), 0);
    return {
      day: dayStart.toLocaleDateString('en-IN', { weekday: 'short' }),
      recovered,
      lost: 0,
    };
  });

  // Customer segment recovery
  const customerSegments = risks.reduce((acc, r) => {
    const level = r.risk_level;
    if (!acc[level]) acc[level] = { total: 0, recovered: 0 };
    acc[level].total += r.amount;
    if (r.status === 'recovered') acc[level].recovered += r.amount;
    return acc;
  }, {} as Record<string, { total: number; recovered: number }>);

  return NextResponse.json({
    analytics: {
      recovered,
      lost,
      atRisk,
      recoveryRate,
      failedPayments: payments.filter((p) => p.status === 'failed').length,
      totalPayments: payments.length,
      interventionPerformance,
      acceptanceRate,
      aiSuccessRate,
      failedInterventions: failedActions.length,
      totalActions: actions.length,
      successfulActions: successCount,
      revenueTrend: last7Days,
      customerSegments,
      totalRisks: risks.length,
      recoveredRisks: risks.filter((r) => r.status === 'recovered').length,
    },
  });
}

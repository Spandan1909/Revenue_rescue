import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getDashboardMetrics } from '@/lib/agents/revenue-rescue';

export async function GET() {
  const supabase = createServerClient();
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (!business) {
    return NextResponse.json({
      totalProcessedRevenue: 0,
      revenueAtRisk: 0,
      revenueRecovered: 0,
      revenueLost: 0,
      recoveryRate: 0,
      failedPayments: 0,
      customersAtRisk: 0,
      activeInterventions: 0,
      averageRecoveryTimeHours: 0,
      riskBreakdown: {
        failed_payments: 0,
        abandoned_checkouts: 0,
        inactive_customers: 0,
        subscription_failures: 0,
      },
    });
  }

  const metrics = await getDashboardMetrics(business.id);
  return NextResponse.json(metrics);
}

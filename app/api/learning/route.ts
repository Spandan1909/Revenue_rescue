import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getLearningSummary } from '@/lib/learning/outcomes';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createServerClient();
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (!business) {
    return NextResponse.json({
      totalInterventions: 0,
      bestAction: null,
      bestRecoveryRate: 0,
      overallRecoveryRate: 0,
      totalRevenueRecovered: 0,
      performance: [],
    });
  }

  const summary = await getLearningSummary(business.id);
  return NextResponse.json(summary);
}

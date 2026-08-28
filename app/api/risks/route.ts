import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createServerClient();

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (!business) {
    return NextResponse.json({ risks: [] });
  }

  const { data } = await supabase
    .from('revenue_risks')
    .select(`
      id,
      customer_id,
      amount,
      risk_type,
      risk_level,
      risk_score,
      reason,
      recommended_action,
      status,
      detected_at,
      customers (
        name,
        email,
        last_payment_at
      )
    `)
    .eq('business_id', business.id)
    .order('detected_at', { ascending: false });

  const risks = (data || []).map((row: Record<string, unknown>) => {
    const c = row.customers as { name?: string; email?: string; last_payment_at?: string } | { name?: string; email?: string; last_payment_at?: string }[] | undefined;
    const customer = Array.isArray(c) ? c[0] : c;
    return {
      id: row.id,
      customer_id: row.customer_id,
      customer_name: (customer as { name?: string })?.name || 'Unknown',
      customer_email: (customer as { email?: string })?.email || '',
      amount: row.amount,
      risk_type: row.risk_type,
      risk_level: row.risk_level,
      risk_score: row.risk_score,
      reason: row.reason,
      recommended_action: row.recommended_action,
      status: row.status,
      detected_at: row.detected_at,
      last_payment_at: (customer as { last_payment_at?: string })?.last_payment_at || null,
    };
  });

  return NextResponse.json({ risks });
}

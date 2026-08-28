import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createServerClient();
  const { data: business } = await supabase.from('businesses').select('id').limit(1).maybeSingle();
  if (!business) return NextResponse.json({ logs: [] });

  const { data } = await supabase
    .from('audit_logs')
    .select(`
      *,
      customers ( name ),
      revenue_risks ( amount, risk_type ),
      agent_actions ( tool_name, decision )
    `)
    .eq('business_id', business.id)
    .order('timestamp', { ascending: false })
    .limit(200);

  const logs = (data || []).map((l: Record<string, unknown>) => {
    const c = l.customers as { name?: string } | { name?: string }[] | undefined;
    const r = l.revenue_risks as { amount?: number; risk_type?: string } | { amount?: number; risk_type?: string }[] | undefined;
    const a = l.agent_actions as { tool_name?: string; decision?: string } | { tool_name?: string; decision?: string }[] | undefined;
    return {
      ...l,
      customer_name: Array.isArray(c) ? c[0]?.name : c?.name,
      risk_amount: Array.isArray(r) ? r[0]?.amount : r?.amount,
      risk_type: Array.isArray(r) ? r[0]?.risk_type : r?.risk_type,
      action_tool: Array.isArray(a) ? a[0]?.tool_name : a?.tool_name,
      action_decision: Array.isArray(a) ? a[0]?.decision : a?.decision,
    };
  });

  return NextResponse.json({ logs });
}

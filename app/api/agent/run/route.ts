import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { runAgentForRisk } from '@/lib/agents/revenue-rescue';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { riskId, businessId } = body;

    if (!riskId || !businessId) {
      return NextResponse.json({ error: 'riskId and businessId required' }, { status: 400 });
    }

    // Verify the risk exists and belongs to this business
    const supabase = createServerClient();
    const { data: risk, error: riskError } = await supabase
      .from('revenue_risks')
      .select('id, business_id')
      .eq('id', riskId)
      .maybeSingle();

    if (riskError) {
      return NextResponse.json({ error: `Failed to fetch risk: ${riskError.message}` }, { status: 500 });
    }
    if (!risk) {
      return NextResponse.json({ error: 'Revenue risk not found' }, { status: 404 });
    }
    if (risk.business_id !== businessId) {
      return NextResponse.json({ error: 'Risk does not belong to this business' }, { status: 403 });
    }

    const result = await runAgentForRisk(riskId, businessId);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  const supabase = createServerClient();
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (!business) return NextResponse.json({ tasks: [], risks: [], businessId: null });

  const [tasksRes, risksRes] = await Promise.all([
    supabase.from('agent_tasks').select('*').eq('business_id', business.id).order('created_at', { ascending: false }).limit(20),
    supabase.from('revenue_risks').select(`
      id, customer_id, amount, risk_type, risk_level, risk_score, reason, recommended_action, status, detected_at,
      customers ( id, name, email, phone, customer_number, status, lifetime_value, total_orders, last_payment_at )
    `).eq('business_id', business.id).in('status', ['open', 'investigating', 'action_pending']).order('detected_at', { ascending: false }),
  ]);

  const risks = (risksRes.data || []).map((r: Record<string, unknown>) => {
    const c = Array.isArray(r.customers) ? (r.customers[0] as Record<string, unknown> | undefined) : (r.customers as Record<string, unknown> | undefined);
    return {
      ...r,
      customer_id: (c?.id as string) || (r.customer_id as string),
      customer_name: (c?.name as string) || undefined,
      customer_email: (c?.email as string) || undefined,
      customer_phone: (c?.phone as string) || undefined,
      customer_number: (c?.customer_number as string) || undefined,
      customer_status: (c?.status as string) || undefined,
      customer_lifetime_value: (c?.lifetime_value as number) || undefined,
      customer_total_orders: (c?.total_orders as number) || undefined,
      customer_last_payment_at: (c?.last_payment_at as string) || undefined,
    };
  });

  return NextResponse.json({ tasks: tasksRes.data || [], risks, businessId: business.id });
}

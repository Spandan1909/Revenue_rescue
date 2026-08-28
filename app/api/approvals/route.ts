import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { executeApprovedAction, confirmRecovery } from '@/lib/agents/revenue-rescue';

export async function GET() {
  const supabase = createServerClient();
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (!business) return NextResponse.json({ approvals: [] });

  const { data } = await supabase
    .from('approvals')
    .select(`
      *,
      customers ( name, email ),
      revenue_risks ( amount, risk_type, reason )
    `)
    .eq('business_id', business.id)
    .order('created_at', { ascending: false });

  const approvals = (data || []).map((a: Record<string, unknown>) => {
    const c = a.customers as { name?: string; email?: string } | { name?: string; email?: string }[] | undefined;
    const r = a.revenue_risks as { amount?: number; risk_type?: string; reason?: string } | { amount?: number; risk_type?: string; reason?: string }[] | undefined;
    const cust = Array.isArray(c) ? c[0] : c;
    const risk = Array.isArray(r) ? r[0] : r;
    return {
      ...a,
      customer_name: cust?.name,
      customer_email: cust?.email,
      risk_amount: risk?.amount,
      risk_type: risk?.risk_type,
      risk_reason: risk?.reason,
    };
  });

  return NextResponse.json({ approvals });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, approvalId, actionId, businessId, modifiedAmount } = body;

    const supabase = createServerClient();

    if (action === 'approve') {
      // Update approval status
      await supabase.from('approvals').update({
        status: 'approved',
        modified_amount: modifiedAmount || null,
        decided_at: new Date().toISOString(),
      }).eq('id', approvalId);

      // Update agent action approval status
      await supabase.from('agent_actions').update({
        approval_status: 'approved',
      }).eq('id', actionId);

      // Execute the action
      const result = await executeApprovedAction(actionId, businessId, modifiedAmount);
      return NextResponse.json(result);
    } else if (action === 'reject') {
      await supabase.from('approvals').update({
        status: 'rejected',
        decided_at: new Date().toISOString(),
      }).eq('id', approvalId);

      await supabase.from('agent_actions').update({
        approval_status: 'rejected',
        execution_status: 'skipped',
      }).eq('id', actionId);

      // Update risk status
      const { data: approval } = await supabase
        .from('approvals')
        .select('revenue_risk_id')
        .eq('id', approvalId)
        .maybeSingle();

      if (approval?.revenue_risk_id) {
        await supabase.from('revenue_risks').update({ status: 'open' }).eq('id', approval.revenue_risk_id);
      }

      return NextResponse.json({ success: true, rejected: true });
    } else if (action === 'confirm_recovery') {
      const result = await confirmRecovery(actionId, businessId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

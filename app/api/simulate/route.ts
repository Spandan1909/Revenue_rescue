import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { runAgentForRisk } from '@/lib/agents/revenue-rescue';
import { recordAudit } from '@/lib/audit/logger';

export async function POST() {
  try {
    const supabase = createServerClient();
    const { data: business } = await supabase.from('businesses').select('id').limit(1).maybeSingle();

    if (!business) {
      return NextResponse.json({ error: 'No business found. Load demo data first.' }, { status: 400 });
    }

    // Find the Rahul Sharma risk (the main demo scenario)
    const { data: rahulCustomer } = await supabase
      .from('customers')
      .select('id, name')
      .eq('name', 'Rahul Sharma')
      .maybeSingle();

    if (!rahulCustomer) {
      return NextResponse.json({ error: 'Demo customer not found. Load demo data first.' }, { status: 400 });
    }

    const { data: risk } = await supabase
      .from('revenue_risks')
      .select('*')
      .eq('customer_id', rahulCustomer.id)
      .eq('risk_type', 'failed_payment')
      .maybeSingle();

    if (!risk) {
      return NextResponse.json({ error: 'No risk found for demo customer' }, { status: 400 });
    }

    // Run the agent on this risk
    const result = await runAgentForRisk(risk.id, business.id);

    return NextResponse.json({
      success: true,
      result,
      message: 'Agent analysis complete. Check the Approvals page for pending actions.',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

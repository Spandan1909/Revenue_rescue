import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createServerClient();
  const { data: business } = await supabase.from('businesses').select('id').limit(1).maybeSingle();
  if (!business) return NextResponse.json({ config: null, stats: null });

  const { data: config } = await supabase
    .from('agent_config')
    .select('*')
    .eq('business_id', business.id)
    .maybeSingle();

  const [tasksRes, actionsRes, approvalsRes, risksRes] = await Promise.all([
    supabase.from('agent_tasks').select('*').eq('business_id', business.id),
    supabase.from('agent_actions').select('*').eq('business_id', business.id),
    supabase.from('approvals').select('*').eq('business_id', business.id),
    supabase.from('revenue_risks').select('*').eq('business_id', business.id),
  ]);

  const tasks = tasksRes.data || [];
  const actions = actionsRes.data || [];
  const approvals = approvalsRes.data || [];
  const risks = risksRes.data || [];

  const stats = {
    completedActions: actions.filter((a) => a.execution_status === 'success').length,
    failedActions: actions.filter((a) => a.execution_status === 'failed').length,
    pendingApprovals: approvals.filter((a) => a.status === 'pending').length,
    activeInvestigations: tasks.filter((t) => t.status === 'running').length,
    completedTasks: tasks.filter((t) => t.status === 'completed').length,
    recoveredRevenue: actions.reduce((s, a) => s + (a.revenue_recovered || 0), 0),
    totalRisks: risks.length,
    openRisks: risks.filter((r) => !['recovered', 'lost'].includes(r.status)).length,
  };

  return NextResponse.json({ config, stats });
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { businessId, ...updates } = body;

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('agent_config')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('business_id', businessId)
      .select()
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ config: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20');

  const supabase = createServerClient();

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (!business) {
    return NextResponse.json({ entries: [] });
  }

  const { data } = await supabase
    .from('audit_logs')
    .select(`
      id,
      timestamp,
      category,
      event,
      revenue_impact,
      details,
      customers ( name )
    `)
    .eq('business_id', business.id)
    .order('timestamp', { ascending: false })
    .limit(limit);

  const entries = (data || []).map((row: Record<string, unknown>) => {
    const c = row.customers as { name?: string } | { name?: string }[] | undefined;
    const customer_name = Array.isArray(c) ? c[0]?.name : c?.name;
    return {
      id: row.id,
      timestamp: row.timestamp,
      category: row.category,
      event: row.event,
      revenue_impact: row.revenue_impact,
      customer_name,
    };
  });

  return NextResponse.json({ entries });
}

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { generateRecoveryCampaign, saveCampaign, sendCampaign } from '@/lib/recovery/campaign';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const supabase = createServerClient();
  const { data: business } = await supabase.from('businesses').select('id').limit(1).maybeSingle();
  if (!business) return NextResponse.json({ campaigns: [] });

  const customerId = searchParams.get('customerId');

  let query = supabase.from('campaigns').select(`
    *, customers ( name, email )
  `).eq('business_id', business.id).order('created_at', { ascending: false });

  if (customerId) query = query.eq('customer_id', customerId);

  const { data } = await query;
  const campaigns = (data || []).map((c: Record<string, unknown>) => {
    const cust = c.customers as { name?: string; email?: string } | { name?: string; email?: string }[] | undefined;
    const cu = Array.isArray(cust) ? cust[0] : cust;
    return {
      ...c,
      customer_name: cu?.name,
      customer_email: cu?.email,
    };
  });

  return NextResponse.json({ campaigns });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, customerId, businessId, campaignId, revenueRiskId } = body;

    if (action === 'generate') {
      const campaign = await generateRecoveryCampaign({ customerId, businessId });
      return NextResponse.json(campaign);
    } else if (action === 'save') {
      const campaign = body.campaign;
      const result = await saveCampaign(customerId, businessId, campaign, revenueRiskId);
      return NextResponse.json(result);
    } else if (action === 'send') {
      await sendCampaign(campaignId, businessId);
      return NextResponse.json({ success: true });
    } else if (action === 'approve') {
      const supabase = createServerClient();
      await supabase.from('campaigns').update({ status: 'approved' }).eq('id', campaignId);
      return NextResponse.json({ success: true });
    } else if (action === 'reject') {
      const supabase = createServerClient();
      await supabase.from('campaigns').update({ status: 'rejected' }).eq('id', campaignId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

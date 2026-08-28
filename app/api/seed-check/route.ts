import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createServerClient();
  const { count } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true });
  return NextResponse.json({ seeded: (count || 0) > 0 });
}

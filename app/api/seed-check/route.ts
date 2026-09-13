import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createServerClient();
    const { count, error } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });

    if (error) {
      return NextResponse.json({
        seeded: false,
        error: error.message,
      });
    }

    return NextResponse.json({ seeded: (count || 0) > 0 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ seeded: false, error: msg });
  }
}

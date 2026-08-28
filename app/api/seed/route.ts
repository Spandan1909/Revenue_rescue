import { NextResponse } from 'next/server';
import { seedDemoData } from '@/lib/database/seed';

export async function POST() {
  try {
    const result = await seedDemoData();
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

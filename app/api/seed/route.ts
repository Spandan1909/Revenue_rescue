import { NextResponse } from 'next/server';
import { seedDemoData } from '@/lib/database/seed';

export async function POST() {
  try {
    const result = await seedDemoData();
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    const cause =
      err instanceof Error && err.cause instanceof Error
        ? err.cause.message
        : undefined;
    return NextResponse.json(
      { error: cause ? `${msg} (${cause})` : msg },
      { status: 500 }
    );
  }
}

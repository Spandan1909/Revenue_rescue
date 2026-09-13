import { NextResponse } from 'next/server';
import { seedDemoData, isTransientError } from '@/lib/database/seed';

export const maxDuration = 60;

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST() {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await seedDemoData();
      return NextResponse.json(result);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES && isTransientError(err)) {
        await delay(RETRY_BASE_DELAY_MS * attempt);
        continue;
      }
      break;
    }
  }

  const err = lastError;
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

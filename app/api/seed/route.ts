import { NextResponse } from 'next/server';
import { seedDemoData } from '@/lib/database/seed';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('fetch failed') ||
      msg.includes('network') ||
      msg.includes('econnreset') ||
      msg.includes('timeout') ||
      msg.includes('socket') ||
      msg.includes('aborted') ||
      msg.includes('tcp')
    );
  }
  return false;
}

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
        await delay(RETRY_DELAY_MS * attempt);
        continue;
      }
      break;
    }
  }

  const err = lastError;
  const msg = err instanceof Error ? err.message : 'Unknown error';
  const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : undefined;
  return NextResponse.json(
    { error: cause ? `${msg} (${cause})` : msg },
    { status: 500 }
  );
}

import { NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const hasKey = !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url || !hasKey) {
    return NextResponse.json({
      status: 'misconfigured',
      hasUrl: !!url,
      hasKey,
      urlPrefix: url ? url.slice(0, 30) + '...' : 'missing',
      message: 'Environment variables are not set. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your Vercel project settings under Settings > Environment Variables, then redeploy.',
    }, { status: 500 });
  }

  try {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const response = await fetch(`${url}/rest/v1/businesses?select=id&limit=1`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    return NextResponse.json({
      status: 'ok',
      httpStatus: response.status,
      urlPrefix: url.slice(0, 30) + '...',
      message: 'Supabase connection successful',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : undefined;
    return NextResponse.json({
      status: 'connection_failed',
      urlPrefix: url.slice(0, 30) + '...',
      error: msg,
      cause,
      message: 'Could not reach Supabase. Check that the URL is correct and the project is not paused.',
    }, { status: 500 });
  }
}

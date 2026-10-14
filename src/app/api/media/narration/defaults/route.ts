import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

/** The default narration pace per course level and the voices on offer (plan 74), for the lesson editor's settings. */
export async function GET(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get('lang') ?? 'nb';
  try {
    const data = await serverFetch({
      service: 'media',
      path: '/media/narration/defaults',
      method: 'GET',
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load the narration defaults' }, { status: 502 });
  }
}

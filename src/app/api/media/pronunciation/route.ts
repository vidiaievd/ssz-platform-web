import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

/**
 * Server-synthesized pronunciation for one word. The clip is generated once per
 * word and served from storage afterwards, so a learner hears the same voice
 * whatever their browser and OS happen to ship.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const data = await serverFetch({
      service: 'media',
      path: '/media/pronunciation',
      method: 'POST',
      body,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof AppError && e.code === 'validation') {
      return NextResponse.json({ error: 'Cannot pronounce that text' }, { status: 422 });
    }
    return NextResponse.json({ error: 'Failed to fetch pronunciation' }, { status: 502 });
  }
}

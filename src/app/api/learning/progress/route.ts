import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type { UpsertProgressRequest, ProgressRecord } from '@/features/learning/types';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { contentType, contentId, timeSpentSeconds, score, completed } = body as UpsertProgressRequest;

  if (!contentType || !contentId || typeof timeSpentSeconds !== 'number' || typeof completed !== 'boolean') {
    return NextResponse.json(
      { error: '"contentType", "contentId", "timeSpentSeconds", and "completed" are required' },
      { status: 400 },
    );
  }

  try {
    const data = await serverFetch<ProgressRecord>({
      service: 'progress',
      path: '/progress',
      method: 'POST',
      body: { contentType, contentId, timeSpentSeconds, score, completed },
    });
    return NextResponse.json(data);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (e.code === 'not_found') return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to save progress' }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

const ProgressEventBody = z.object({
  contentId: z.string(),
  contentType: z.enum(['LESSON', 'EXERCISE', 'VOCABULARY_LIST']),
  event: z.enum(['started', 'completed']),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ProgressEventBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 422 });
  }

  try {
    await serverFetch({
      service: 'progress',
      path: '/api/v1/progress',
      method: 'POST',
      body: parsed.data,
    });

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to record progress event' }, { status: 502 });
  }
}

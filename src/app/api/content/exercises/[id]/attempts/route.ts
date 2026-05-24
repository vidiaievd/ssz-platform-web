import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

const StartAttemptResponse = z.object({
  attemptId: z.string(),
  exerciseId: z.string(),
  startedAt: z.string(),
});

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const data = await serverFetch({
      service: 'exercises',
      path: `/api/v1/exercises/${id}/attempts`,
      method: 'POST',
    });

    const parsed = StartAttemptResponse.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid upstream response' }, { status: 502 });
    }

    return NextResponse.json(parsed.data, { status: 201 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Exercise not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to start attempt' }, { status: 502 });
  }
}

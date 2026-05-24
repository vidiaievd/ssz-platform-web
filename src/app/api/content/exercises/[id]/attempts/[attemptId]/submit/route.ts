import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

const SubmitAnswerResponse = z.object({
  verdict: z.enum(['correct', 'partial', 'incorrect']),
  correctAnswer: z.union([z.string(), z.array(z.string())]).optional(),
  explanation: z.string().optional(),
  requiresReview: z.boolean().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attemptId: string }> },
) {
  const { id, attemptId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const data = await serverFetch({
      service: 'exercises',
      path: `/api/v1/exercises/${id}/attempts/${attemptId}/submit`,
      method: 'POST',
      body,
    });

    const parsed = SubmitAnswerResponse.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid upstream response' }, { status: 502 });
    }

    return NextResponse.json(parsed.data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to submit attempt' }, { status: 502 });
  }
}

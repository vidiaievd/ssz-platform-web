import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type { GradedSubmitRequest, GradedSubmitResponse, WrittenSubmitRequest } from '@/features/learning/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const data = await serverFetch<GradedSubmitResponse>({
      service: 'progress',
      path: `/assignments/${id}/submit`,
      method: 'POST',
      body: body as GradedSubmitRequest | WrittenSubmitRequest,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (e.code === 'not_found') return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
      if (e.code === 'conflict') return NextResponse.json({ error: 'Already submitted' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to submit assignment' }, { status: 502 });
  }
}

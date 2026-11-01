import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';

/**
 * «Add to review» for a grammar rule the learner has reached (platform plan 85, step 8).
 *
 * learning-service decides whether the rule counts as reached: 422 means it does not, so the
 * client drops the offer; 503 means the answer could not be worked out and is worth another
 * try. Idempotent upstream — a rule that already has a card comes back as it is.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ atomId: string }> },
) {
  const { atomId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { courseId } = (body ?? {}) as { courseId?: unknown };
  if (typeof courseId !== 'string' || courseId === '') {
    return NextResponse.json({ error: '"courseId" is required' }, { status: 400 });
  }

  try {
    const data = await serverFetch({
      service: 'progress',
      path: `/srs/atoms/${encodeURIComponent(atomId)}/add`,
      method: 'POST',
      body: { courseId },
      expectedErrorStatuses: [400, 422, 503],
    });
    return NextResponse.json(data);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (e.code === 'validation') {
        return NextResponse.json({ error: 'Rule not reached' }, { status: 422 });
      }
      if (e.code === 'upstream_unavailable') {
        return NextResponse.json({ error: 'Try again later' }, { status: 503 });
      }
    }
    return NextResponse.json({ error: 'Could not add the rule' }, { status: 502 });
  }
}

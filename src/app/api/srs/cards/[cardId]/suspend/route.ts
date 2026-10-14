import { NextRequest, NextResponse } from 'next/server';

import { isAppError } from '@/lib/errors';
import { serverFetch } from '@/lib/api/server-fetcher';

/**
 * `POST /srs/cards/:id/suspend` (learning-service). Used by «My words» (plan 75): a word of
 * the student's own leaves review when deleted, and comes back when added again.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await params;
  try {
    const card = await serverFetch({
      service: 'progress',
      path: `/srs/cards/${cardId}/suspend`,
      method: 'POST',
    });
    return NextResponse.json(card);
  } catch (e) {
    if (isAppError(e)) {
      const status = e.code === 'not_found' ? 404 : e.code === 'unauthenticated' ? 401 : 502;
      return NextResponse.json({ error: e.message }, { status });
    }
    return NextResponse.json({ error: 'Failed to suspend the card' }, { status: 502 });
  }
}

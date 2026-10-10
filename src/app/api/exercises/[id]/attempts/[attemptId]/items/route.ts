import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type { MinimalPairsProbe } from '@/features/student/exercises/types/attempts';

/**
 * The probe a `minimal_pairs` sitting is on — its clip and its buttons (plan 72 §3.6).
 *
 * The draw was made when the attempt opened and stays on the server, so the order of the probes
 * never sits in the page: each one is handed out here, the first one still open, and asking
 * again returns the same probe until it is answered. Which button the clip is does not come
 * back — `/answers` judges the pick against the draw.
 *
 * Takes no body: there is no way to ask for a probe other than the current one.
 *
 * Two refusals carry their code through, because the runner does different things with them:
 * `ALL_PROBES_CLOSED` means the sitting is waiting for its submit (a reload after the last
 * answer), and `MEDIA_UNAVAILABLE` means the clip could not be signed — nothing was recorded,
 * and asking again later is the remedy.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attemptId: string }> },
) {
  const { id, attemptId } = await params;

  try {
    const data = await serverFetch<MinimalPairsProbe>({
      service: 'exercises',
      path: `/exercises/${id}/attempts/${attemptId}/items`,
      method: 'POST',
    });
    return NextResponse.json(data);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (e.code === 'forbidden') {
        return NextResponse.json({ error: 'Not your attempt' }, { status: 403 });
      }
      if (e.code === 'not_found') {
        return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
      }
      if (e.code === 'validation') {
        const code = codeOf(e.details);
        return NextResponse.json(
          {
            error: 'No probe to hand out',
            ...(code === 'ALL_PROBES_CLOSED' || code === 'NOT_A_PROBE_SET' ? { code } : {}),
          },
          { status: 422 },
        );
      }
      if (e.code === 'upstream_unavailable' && codeOf(e.details) === 'MEDIA_UNAVAILABLE') {
        return NextResponse.json(
          { error: 'The clip cannot be played right now', code: 'MEDIA_UNAVAILABLE' },
          { status: 503 },
        );
      }
    }
    return NextResponse.json({ error: 'Could not hand out the probe' }, { status: 502 });
  }
}

function codeOf(details: unknown): string | null {
  if (typeof details !== 'object' || details === null) return null;
  const { code } = details as { code?: unknown };
  return typeof code === 'string' ? code : null;
}

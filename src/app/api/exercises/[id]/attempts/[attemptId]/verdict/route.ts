import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { fetchProfileSummaries } from '@/lib/api/profile-directory';
import { isAppError } from '@/lib/errors';
import type { AttemptStatus } from '@/features/student/exercises/types/attempts';
import type { ReturnedVerdict } from '@/features/student/submissions/types';

/**
 * What the engine keeps about one attempt. Far more than this route hands on — the record
 * carries the learner's answer and, on some templates, the validator's reading of it.
 */
interface EngineAttempt {
  status: AttemptStatus;
  templateCode: string;
  reviewComment: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
}

/**
 * The verdict a learner is coming back from, for the banner above the second attempt.
 *
 * The runner is reached by a link — `?from=submission&attempt=<id>` — and a link survives
 * a reload, a bookmark and a day. So the comment it shows has to be fetchable from the two
 * ids in the address bar rather than carried over from the screen that linked here; a
 * banner that vanished on refresh would send the learner back to hunt for the comment,
 * which is the thing 47.3 exists to stop (criterion 39).
 *
 * Three fields go out and nothing else. The engine's attempt record is not forwarded: it
 * holds `submittedAnswer` and `validationDetails`, and on a GRADED translate attempt the
 * latter is the accepted translation of every sentence. `reviewDecisions` is dropped for
 * a different reason — per-item notes are still an open question (plan 47 §4.1), and a
 * screen must not start showing them by inheriting a passthrough.
 *
 * Ownership is the engine's to enforce and it does: the attempt is read as the signed-in
 * user, and someone else's comes back 404.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attemptId: string }> },
) {
  const { id, attemptId } = await params;

  let attempt: EngineAttempt;
  try {
    attempt = await serverFetch<EngineAttempt>({
      service: 'exercises',
      path: `/exercises/${id}/attempts/${attemptId}`,
      method: 'GET',
    });
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (e.code === 'not_found' || e.code === 'forbidden') {
        return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
      }
    }
    return NextResponse.json({ error: 'Failed to load the verdict' }, { status: 502 });
  }

  // A name costs one directory lookup and its absence costs only the name: an unsigned
  // comment is still the comment the learner has to work from.
  const people =
    attempt.reviewedByUserId === null
      ? {}
      : await fetchProfileSummaries([attempt.reviewedByUserId]);

  const verdict: ReturnedVerdict = {
    attemptId,
    exerciseId: id,
    status: attempt.status,
    comment: attempt.reviewComment,
    teacherName:
      attempt.reviewedByUserId === null
        ? null
        : (people[attempt.reviewedByUserId]?.displayName ?? null),
    at: attempt.reviewedAt,
  };

  return NextResponse.json(verdict);
}

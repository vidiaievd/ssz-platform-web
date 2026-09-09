import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { fetchProfileSummaries } from '@/lib/api/profile-directory';
import { env } from '@/lib/env';
import { resolveReviewScope, type ReviewScope } from '@/features/review/lib/review-scope';
import { authorizeSubmission, refuseSubmission } from '@/features/review/lib/submission-access';
import type { ReviewLockState } from '@/features/review/types';

/** What the engine answers to both calls: who holds it now, if anyone. */
interface EngineLock {
  lock: { teacherId: string; expiresAt: string } | null;
}

/**
 * "I am looking at this one."
 *
 * The marker is advisory by design (`API_CONTRACT.md` §3): placing one never displaces a
 * colleague's, and failing to get one never closes the screen. What it buys is the line on
 * the queue row — two teachers of one group marking the same morning is the ordinary case,
 * and the cheap fix for it is telling each of them that the other is here, not locking a
 * door and inventing a way to unlock it when a browser tab dies.
 *
 * The write authorisation is the strict one: a stand-in whose window has closed may read
 * the submission but not take it (`DATA_MODEL.md` §3), because a marker in their name
 * would advertise them as the person answering when they no longer are.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return lockCall(request, context, 'POST');
}

/** Leaving the screen. Idempotent, and it never lifts a colleague's marker. */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return lockCall(request, context, 'DELETE');
}

async function lockCall(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  method: 'POST' | 'DELETE',
) {
  const { id } = await context.params;
  const school = request.nextUrl.searchParams.get('school');
  if (!school) {
    return NextResponse.json({ error: 'school is required' }, { status: 400 });
  }

  const scope = await resolveReviewScope(school);
  if (scope instanceof NextResponse) return scope;

  const subject = await subjectOf(scope, id);
  if (subject === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const access = await authorizeSubmission(scope, subject);
  if (!access.write) return refuseSubmission(access.reason ?? 'not_a_reviewer');

  let result: EngineLock;
  try {
    result = await serverFetch<EngineLock>({
      service: 'exercises',
      path: `/internal/attempts/${id}/review/lock`,
      method,
      directBaseUrl: env.EXERCISE_SERVICE_INTERNAL_URL,
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
      anonymous: true,
      body: { schoolId: scope.schoolId, teacherId: scope.teacherId },
      expectedErrorStatuses: [404, 422],
    });
  } catch {
    // A submission already decided, or one that never went to a person, cannot be marked
    // — and neither is worth failing the screen over: the reviewer is told who holds it,
    // and "nobody" is a truthful answer here.
    return NextResponse.json({ lock: null, mine: false } satisfies ReviewLockState);
  }

  const holder = result.lock?.teacherId ?? null;
  const names = holder === null ? {} : await fetchProfileSummaries([holder]);

  return NextResponse.json({
    lock: result.lock
      ? {
          teacherId: result.lock.teacherId,
          teacherName: names[result.lock.teacherId]?.displayName ?? null,
          expiresAt: result.lock.expiresAt,
        }
      : null,
    mine: holder === scope.teacherId,
  } satisfies ReviewLockState);
}

/**
 * The group and the submission time — the two facts the rule is evaluated on.
 *
 * Read from the engine rather than taken from the request, so that a caller cannot claim
 * a group they hold for a submission that belongs to another one.
 */
async function subjectOf(
  scope: ReviewScope,
  attemptId: string,
): Promise<{ groupId: string | null; submittedAt: string | null } | null> {
  try {
    const submission = await serverFetch<{ groupId: string | null; submittedAt: string | null }>({
      service: 'exercises',
      path: `/internal/attempts/${attemptId}/review`,
      directBaseUrl: env.EXERCISE_SERVICE_INTERNAL_URL,
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
      anonymous: true,
      query: { schoolId: scope.schoolId },
      expectedErrorStatuses: [404],
    });
    return { groupId: submission.groupId, submittedAt: submission.submittedAt };
  } catch {
    return null;
  }
}

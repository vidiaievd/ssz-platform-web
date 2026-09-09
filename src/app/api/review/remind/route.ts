import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';
import { env } from '@/lib/env';
import { resolveOversightAccess, reviewScopeAt } from '@/features/review/lib/review-scope';
import type { ReviewRemindResult } from '@/features/review/types/oversight';

/**
 * Ask one reviewer to look at what has piled up on them.
 *
 * One message with a number in it, never a letter per submission — a learner sitting down
 * for an evening hands in a dozen exercises, and a reminder per piece of work would be a
 * dozen notifications about one evening (`BEHAVIOR.md` §C).
 *
 * The count is worked out here rather than taken from the browser: the screen's figure is
 * up to a minute old and counts a shared group for both its reviewers, while the message
 * should say what is waiting on *this* person right now. organization-service then holds
 * the rate limit, because the limit has to survive a restart and hold across every
 * administrator of the school — a limit kept in this process would be per-instance and
 * per-deploy.
 */
export async function POST(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const school = searchParams.get('school');
  if (!school) {
    return NextResponse.json({ error: 'school is required' }, { status: 400 });
  }

  const access = await resolveOversightAccess(school);
  if (access instanceof NextResponse) return access;

  let teacherId: string;
  try {
    const body = (await request.json()) as { teacherId?: unknown };
    if (typeof body.teacherId !== 'string' || body.teacherId === '') throw new Error('bad body');
    teacherId = body.teacherId;
  } catch {
    return NextResponse.json({ error: 'teacherId is required' }, { status: 400 });
  }

  const pending = await countWaitingOn(access.schoolId, teacherId);

  try {
    await serverFetch({
      service: 'organization',
      path: `/schools/${access.schoolId}/review-reminders`,
      method: 'POST',
      body: { teacherId, pending },
    });
  } catch (error) {
    // Reminded already today. Not a failure of the screen: the answer says when the next
    // one may go, and the row explains itself rather than showing an error.
    if (error instanceof AppError && error.code === 'rate_limited') {
      const details = error.details as { nextAllowedAt?: string } | undefined;
      const result: ReviewRemindResult = {
        sent: false,
        pending,
        retryAfterHours: hoursUntil(details?.nextAllowedAt),
      };
      return NextResponse.json(result, { status: 200 });
    }
    return NextResponse.json({ error: 'The reminder could not be sent' }, { status: 502 });
  }

  const result: ReviewRemindResult = { sent: true, pending };
  return NextResponse.json(result);
}

/**
 * What is waiting on this reviewer right now, counted through their own groups.
 *
 * Zero is a perfectly good answer and is still sent: an administrator pressing "remind"
 * on a row that has just been cleared should get "nothing is waiting", not a message
 * claiming otherwise.
 */
async function countWaitingOn(schoolId: string, teacherId: string): Promise<number> {
  try {
    const scope = await reviewScopeAt(schoolId, teacherId, new Date().toISOString());
    if (scope.groupIds.length === 0) return 0;

    const summary = await serverFetch<{ pending: number }>({
      service: 'exercises',
      path: '/internal/attempts/review/queue/count',
      method: 'POST',
      directBaseUrl: env.EXERCISE_SERVICE_INTERNAL_URL,
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
      anonymous: true,
      body: { schoolId, groupIds: scope.groupIds },
    });
    return summary.pending;
  } catch {
    return 0;
  }
}

/** Rounded up: "in about 3 hours" is right where "in 2 hours" would be early. */
function hoursUntil(iso: string | undefined): number | undefined {
  if (iso === undefined) return undefined;
  const ms = new Date(iso).getTime() - Date.now();
  return Number.isFinite(ms) ? Math.max(1, Math.ceil(ms / 3_600_000)) : undefined;
}

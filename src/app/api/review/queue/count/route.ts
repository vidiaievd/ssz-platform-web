import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { env } from '@/lib/env';
import { hoursSince } from '@/features/review/lib/age-scale';
import { buildSlaMap } from '@/features/review/lib/sla-map';
import { queueScopeFor, resolveReviewScope } from '@/features/review/lib/review-scope';
import type { ReviewQueueCount } from '@/features/review/types';

const NO_SCOPE: ReviewQueueCount = { pending: 0, hasOverdue: false, hasScope: false };

/**
 * The sidebar badge: how many are waiting, and whether a dot belongs beside the number.
 *
 * Deliberately not the queue with `limit=1`. This runs on every window focus and after
 * every verdict, and it must stay one count and one `MIN(submitted_at)` — no page of rows,
 * no names, no per-course promises for courses nobody is looking at.
 *
 * The dot is where that thrift shows. Knowing exactly whether anything is late would mean
 * pairing every waiting submission with its own course's promise, which is the queue's
 * work; instead the oldest submission in the scope is measured against the *shortest*
 * promise in play. That can raise the dot when the oldest submission is still inside its
 * own course's longer promise while some other course promises sooner. It cannot ever
 * miss one, and the error runs the safe way: the dot is a reason to open the screen, not a
 * measure of how bad things are (criterion 9), and the screen itself then reports exactly.
 */
export async function GET(request: NextRequest) {
  const school = request.nextUrl.searchParams.get('school');
  if (!school) {
    return NextResponse.json({ error: 'school is required' }, { status: 400 });
  }

  const scope = await resolveReviewScope(school);
  if (scope instanceof NextResponse) return scope;

  const engineScope = queueScopeFor(scope, {});
  if (engineScope === null) return NextResponse.json(NO_SCOPE);

  let summary: { pending: number; oldestSubmittedAt: string | null };
  try {
    summary = await serverFetch({
      service: 'exercises',
      path: '/internal/attempts/review/queue/count',
      method: 'POST',
      directBaseUrl: env.EXERCISE_SERVICE_INTERNAL_URL,
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
      anonymous: true,
      body: engineScope,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to count the review queue' }, { status: 502 });
  }

  if (summary.pending === 0 || summary.oldestSubmittedAt === null) {
    return NextResponse.json({ pending: summary.pending, hasOverdue: false, hasScope: true });
  }

  // The school's promise and the overrides of the courses this teacher's groups run —
  // the only promises any of their submissions could be held to.
  const sla = await buildSlaMap(scope.schoolId, scope.containerIds);
  const promises = [
    ...(sla.schoolHours === null ? [] : [sla.schoolHours]),
    ...Object.values(sla.byCourse),
  ];

  const body: ReviewQueueCount = {
    pending: summary.pending,
    hasScope: true,
    hasOverdue:
      promises.length > 0 && hoursSince(summary.oldestSubmittedAt) > Math.min(...promises),
  };

  return NextResponse.json(body);
}

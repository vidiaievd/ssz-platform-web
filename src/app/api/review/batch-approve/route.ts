import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { env } from '@/lib/env';
import {
  queueScopeFor,
  resolveReviewScope,
  type ReviewScope,
} from '@/features/review/lib/review-scope';
import type { ReviewBatchResult, ReviewBatchSkipReason } from '@/features/review/types';

interface BatchRequest {
  attemptIds?: unknown;
}

/** What the engine answers (plan 44 §44.10). */
interface EngineBatchResult {
  approved: number;
  skipped: { id: string; reason: ReviewBatchSkipReason }[];
}

/** The engine's own ceiling on one batch, restated so the refusal happens before the call. */
const MAX_BATCH = 100;

/**
 * How far into the caller's queue this route will look for the submissions it was given.
 *
 * The ids come from a group the teacher can see, and what they can see is the first page
 * of their own queue — so anything a real batch names is found long before this. The cap
 * is here so that a caller sending a hundred ids that are not theirs cannot walk the
 * whole school's queue looking for them.
 */
const MAX_SCOPE_PAGES = 5;
const SCOPE_PAGE = 100;

/**
 * Approve a named list of submissions the machine had already closed.
 *
 * The list is the list. Nothing here expands "all the clean ones in that group" — the
 * modal showed the teacher those learners by name and it is exactly that set which must
 * be carried out (`API_CONTRACT.md` §5), because the group on their screen is a few
 * seconds old and the queue is shared.
 *
 * Authorisation is per submission, as it is for a single verdict, but asked the cheap way
 * round: rather than reading every attempt and re-deriving the rule for each, the route
 * asks what is in *this teacher's queue* and keeps only ids that are in it. That answer
 * already carries the whole rule — it is the same scoped query the inbox is drawn from —
 * and it also settles "is it still waiting", which reading the attempt would not.
 *
 * An id that is not in the queue is not an error. A colleague answering one of the six in
 * the last few seconds is the ordinary case, and it comes back as a skipped name with a
 * reason beside the five that went through.
 */
export async function POST(request: NextRequest) {
  const school = request.nextUrl.searchParams.get('school');
  if (!school) {
    return NextResponse.json({ error: 'school is required' }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as BatchRequest;
  const attemptIds = Array.isArray(body.attemptIds)
    ? [...new Set(body.attemptIds.filter((id): id is string => typeof id === 'string'))]
    : [];

  if (attemptIds.length === 0) {
    return NextResponse.json({ error: 'attemptIds is required' }, { status: 400 });
  }
  if (attemptIds.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `At most ${MAX_BATCH} submissions may be approved at once` },
      { status: 422 },
    );
  }

  const scope = await resolveReviewScope(school);
  if (scope instanceof NextResponse) return scope;

  const mine = await reviewableIds(scope, new Set(attemptIds));
  const allowed = attemptIds.filter((id) => mine.has(id));
  // Everything else left the caller's queue between the modal opening and this call —
  // or was never in it. One reason, because from here the two are indistinguishable.
  const skipped = attemptIds
    .filter((id) => !mine.has(id))
    .map((id) => ({ id, reason: 'not_found' as const }));

  if (allowed.length === 0) {
    return NextResponse.json({ approved: 0, skipped } satisfies ReviewBatchResult);
  }

  let result: EngineBatchResult;
  try {
    result = await serverFetch<EngineBatchResult>({
      service: 'exercises',
      path: '/internal/attempts/review/batch-approve',
      method: 'POST',
      directBaseUrl: env.EXERCISE_SERVICE_INTERNAL_URL,
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
      anonymous: true,
      body: { schoolId: scope.schoolId, reviewerId: scope.teacherId, attemptIds: allowed },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to approve the submissions' }, { status: 502 });
  }

  return NextResponse.json({
    approved: result.approved,
    skipped: [...result.skipped, ...skipped],
  } satisfies ReviewBatchResult);
}

/**
 * Which of these submissions are in this teacher's queue right now.
 *
 * Walks pages only until every id asked about has been accounted for, so the ordinary
 * batch — half a dozen ids from the group at the top of the list — costs one call.
 */
async function reviewableIds(scope: ReviewScope, wanted: Set<string>): Promise<Set<string>> {
  const engineScope = queueScopeFor(scope, {});
  const found = new Set<string>();
  if (engineScope === null) return found;

  let cursor: string | null = null;

  for (let page = 0; page < MAX_SCOPE_PAGES; page += 1) {
    let queue: {
      groups: { items: { attemptId: string }[] }[];
      nextCursor: string | null;
    };

    try {
      queue = await serverFetch({
        service: 'exercises',
        path: '/internal/attempts/review/queue',
        method: 'POST',
        directBaseUrl: env.EXERCISE_SERVICE_INTERNAL_URL,
        headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
        anonymous: true,
        body: { ...engineScope, limit: SCOPE_PAGE, ...(cursor ? { cursor } : {}) },
      });
    } catch {
      // No answer is not an authorisation: nothing is approved on a queue we could not read.
      return found;
    }

    for (const group of queue.groups) {
      for (const item of group.items) {
        if (wanted.has(item.attemptId)) found.add(item.attemptId);
      }
    }

    if (found.size === wanted.size || queue.nextCursor === null) break;
    cursor = queue.nextCursor;
  }

  return found;
}

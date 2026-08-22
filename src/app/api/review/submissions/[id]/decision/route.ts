import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { fetchProfileSummaries } from '@/lib/api/profile-directory';
import { isAppError } from '@/lib/errors';
import { env } from '@/lib/env';
import { hoursSince, isOverdue } from '@/features/review/lib/age-scale';
import { buildSlaMap } from '@/features/review/lib/sla-map';
import {
  queueScopeFor,
  resolveReviewScope,
  type ReviewScope,
} from '@/features/review/lib/review-scope';
import { authorizeSubmission, refuseSubmission } from '@/features/review/lib/submission-access';
import {
  REVIEWABLE_EXERCISE_TYPES,
  type ReviewGroupBy,
  type ReviewableExerciseType,
} from '@/features/review/types';

/** The verdicts the screen offers. The engine has two; the third is an approval with words. */
const VERDICTS = ['approved', 'approved_comment', 'returned'] as const;
type Verdict = (typeof VERDICTS)[number];

interface DecisionRequest {
  verdict?: string;
  comment?: string | null;
  sentenceComments?: Record<string, string>;
  /**
   * Rubric marks 0-3 by criterion id, for a submission graded that way.
   *
   * Forwarded unread. The engine grades them against the rubric it froze on the attempt
   * and derives the verdict from the threshold — this route has neither the rubric nor
   * the weights, and a copy of the arithmetic here would be a second opinion about the
   * same marks. Criterion 19 is untouched: judgements travel, a score never does.
   */
  rubricMarks?: Record<string, number>;
  /**
   * The queue as the reviewer currently has it arranged. Sent rather than assumed,
   * because what "the next one" means is exactly the list on their screen.
   */
  filters?: {
    groupBy?: string;
    group?: string | null;
    course?: string | null;
    type?: string | null;
    overdueOnly?: boolean;
  };
}

/** What the reviewer is handed back: where to go, and nothing to decide about it. */
interface DecisionResponse {
  nextId: string | null;
}

/** Only the parts of the submission this route reasons about. */
interface EngineSubject {
  attemptId: string;
  groupId: string | null;
  containerId: string | null;
  submittedAt: string | null;
}

/** One row of the queue, as far as picking the next one needs it. */
interface QueueCandidate {
  attemptId: string;
  containerId: string | null;
  submittedAt: string;
}

const NEXT_LOOKAHEAD = 100;

/**
 * The teacher's verdict — and the submission after it.
 *
 * Two things happen here that the engine cannot do for itself. It authorises nothing, so
 * the right to decide is established first and against the moment the work was handed in
 * (`DATA_MODEL.md` §3): a stand-in whose window has closed reads the submission and is
 * refused the verdict, with a reason rather than a blank 403.
 *
 * And the answer carries `nextId`, because marking is a pass through a list and the list
 * lives on the server. A screen that picked the next row itself would pick from the page
 * it happened to have loaded, which is not the queue after a verdict has left it.
 *
 * No score travels in either direction (criterion 19). The engine derives it from what it
 * can see, so two teachers making the same decisions cannot produce two different marks.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const school = request.nextUrl.searchParams.get('school');
  if (!school) {
    return NextResponse.json({ error: 'school is required' }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as DecisionRequest;
  const verdict = body.verdict as Verdict;
  if (!VERDICTS.includes(verdict)) {
    return NextResponse.json({ error: 'Unknown verdict' }, { status: 400 });
  }

  const scope = await resolveReviewScope(school);
  if (scope instanceof NextResponse) return scope;

  const subject = await subjectOf(scope, id);
  if (subject === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const access = await authorizeSubmission(scope, subject);
  if (!access.write) return refuseSubmission(access.reason ?? 'not_a_reviewer');

  try {
    await serverFetch({
      service: 'exercises',
      path: `/internal/attempts/${id}/review`,
      method: 'POST',
      directBaseUrl: env.EXERCISE_SERVICE_INTERNAL_URL,
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
      anonymous: true,
      body: {
        reviewerId: scope.teacherId,
        outcome: verdict,
        comment: body.comment ?? null,
        sentenceComments: body.sentenceComments ?? {},
        ...(body.rubricMarks === undefined ? {} : { rubricMarks: body.rubricMarks }),
      },
      // Both are outcomes the screen has a shape for, not faults worth logging as such.
      expectedErrorStatuses: [409, 422],
    });
  } catch (error) {
    return await refuseVerdict(error);
  }

  return NextResponse.json({
    nextId: await nextSubmission(scope, subject, body.filters ?? {}),
  } satisfies DecisionResponse);
}

/**
 * The two refusals the screen draws differently, and everything else.
 *
 * A conflict is named: the colleague's id becomes their name here, because the banner has
 * to say who decided and what they decided (criterion 24) and a bare id would read as a
 * fault. A return without a comment travels as a code, so the screen can put the message
 * beside the field it belongs to rather than in a toast (criterion 18).
 */
async function refuseVerdict(error: unknown): Promise<NextResponse> {
  if (!isAppError(error)) {
    return NextResponse.json({ error: 'Failed to record the verdict' }, { status: 502 });
  }

  const details = (error.details ?? {}) as {
    code?: string;
    by?: string;
    verdict?: 'approved' | 'returned';
    at?: string;
    missing?: string[];
  };

  if (error.code === 'conflict' && details.by) {
    const names = await fetchProfileSummaries([details.by]);
    return NextResponse.json(
      {
        code: 'ALREADY_REVIEWED',
        by: details.by,
        byName: names[details.by]?.displayName ?? null,
        verdict: details.verdict ?? 'approved',
        at: details.at ?? new Date().toISOString(),
      },
      { status: 409 },
    );
  }

  if (details.code === 'RETURN_REQUIRES_COMMENT') {
    return NextResponse.json({ code: 'RETURN_REQUIRES_COMMENT' }, { status: 422 });
  }

  // Which criteria are still blank, so the screen can point at them rather than report a
  // verdict that failed for reasons of its own. The screen keeps the action disabled
  // until the rubric is whole, so reaching this means two tabs or a stale one.
  if (details.code === 'RUBRIC_INCOMPLETE') {
    return NextResponse.json(
      { code: 'RUBRIC_INCOMPLETE', missing: details.missing ?? [] },
      { status: 422 },
    );
  }

  return NextResponse.json({ error: 'Failed to record the verdict' }, { status: 502 });
}

/**
 * Where the reviewer goes next, in the queue as they currently have it arranged.
 *
 * The queue is ordered oldest first, so "next" is the first submission that sorts after
 * the one just decided — compared on the ordering the API contract states rather than on
 * a cursor token, which is the engine's format to change.
 *
 * When nothing sorts after it, the answer is the top of the queue rather than nothing:
 * a reviewer who opened a row halfway down has finished the tail, not the queue, and
 * telling them everything is reviewed while a pile waits above would be a lie. `null`
 * therefore means one thing only — the queue is empty (criterion 16).
 *
 * A failure here costs the automatic step forward and not the verdict, which is already
 * recorded; the screen falls back to its "reviewed, go on" state.
 */
async function nextSubmission(
  scope: ReviewScope,
  decided: EngineSubject,
  filters: NonNullable<DecisionRequest['filters']>,
): Promise<string | null> {
  const type = REVIEWABLE_EXERCISE_TYPES.includes(filters.type as ReviewableExerciseType)
    ? (filters.type as ReviewableExerciseType)
    : null;

  const engineScope = queueScopeFor(scope, {
    group: filters.group ?? null,
    course: filters.course ?? null,
    type,
  });
  if (engineScope === null) return null;

  const groupBy: ReviewGroupBy = filters.groupBy === 'student' ? 'student' : 'exercise';

  let candidates: QueueCandidate[];
  try {
    const queue = await serverFetch<{ groups: { items: QueueCandidate[] }[] }>({
      service: 'exercises',
      path: '/internal/attempts/review/queue',
      method: 'POST',
      directBaseUrl: env.EXERCISE_SERVICE_INTERNAL_URL,
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
      anonymous: true,
      body: { ...engineScope, groupBy, limit: NEXT_LOOKAHEAD },
    });
    candidates = queue.groups.flatMap((group) => group.items);
  } catch {
    return null;
  }

  // The one just decided has left the queue upstream, but a read racing the write may
  // still carry it, and offering the reviewer the work they have just finished is the
  // one answer that is certainly wrong.
  candidates = candidates.filter((item) => item.attemptId !== decided.attemptId);

  if (filters.overdueOnly === true) {
    const sla = await buildSlaMap(
      scope.schoolId,
      candidates.map((item) => item.containerId).filter((id): id is string => id !== null),
    );
    const now = new Date();
    candidates = candidates.filter((item) => {
      const slaHours = sla.slaFor(item.containerId);
      return slaHours !== null && isOverdue(hoursSince(item.submittedAt, now), slaHours);
    });
  }

  const sorted = [...candidates].sort(compareByAge);
  const first = sorted[0];
  if (first === undefined) return null;

  const decidedKey =
    decided.submittedAt === null
      ? null
      : { submittedAt: decided.submittedAt, attemptId: decided.attemptId };
  const next =
    decidedKey === null ? undefined : sorted.find((item) => compareByAge(item, decidedKey) > 0);

  return (next ?? first).attemptId;
}

/** Oldest first, ties broken by id — the order the queue itself is served in. */
function compareByAge(
  a: { submittedAt: string; attemptId: string },
  b: { submittedAt: string; attemptId: string },
): number {
  const byTime = Date.parse(a.submittedAt) - Date.parse(b.submittedAt);
  return byTime !== 0 ? byTime : a.attemptId.localeCompare(b.attemptId);
}

/**
 * The facts the rule is evaluated on, read from the engine rather than from the request:
 * a caller must not be able to claim a group they hold for a submission in another one.
 */
async function subjectOf(scope: ReviewScope, attemptId: string): Promise<EngineSubject | null> {
  try {
    const submission = await serverFetch<EngineSubject>({
      service: 'exercises',
      path: `/internal/attempts/${attemptId}/review`,
      directBaseUrl: env.EXERCISE_SERVICE_INTERNAL_URL,
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
      anonymous: true,
      query: { schoolId: scope.schoolId },
      expectedErrorStatuses: [404],
    });
    return { ...submission, attemptId };
  } catch {
    return null;
  }
}

import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { fetchProfileSummaries } from '@/lib/api/profile-directory';
import { env } from '@/lib/env';
import { hoursSince, isOverdue } from '@/features/review/lib/age-scale';
import { buildSlaMap } from '@/features/review/lib/sla-map';
import { fetchGroupNames, resolveReviewScope } from '@/features/review/lib/review-scope';
import { authorizeSubmission, refuseSubmission } from '@/features/review/lib/submission-access';
import type { ReviewDetails } from '@/features/content-authoring/types/review';
import type { ReviewSubmission, ReviewVerdictRecord } from '@/features/review/types';

/** A verdict as the engine records it — a reviewer id, and no name to go with it. */
interface EngineVerdict {
  attemptId: string;
  outcome: 'approved' | 'returned';
  at: string;
  reviewerId: string;
  comment: string | null;
}

/** The engine's answer to `GET :attemptId/review` (plan 44.7). */
interface EngineSubmission {
  attemptId: string;
  userId: string;
  status: string;
  schoolId: string | null;
  containerId: string | null;
  groupId: string | null;
  exerciseId: string;
  templateCode: string;
  targetLanguage: string;
  path: { course?: string | null; module?: string | null; exercise?: string | null } | null;
  exerciseAvailable: boolean;
  submittedAt: string | null;
  attemptNo: number;
  previous: EngineVerdict | null;
  decision: EngineVerdict | null;
  lock: { teacherId: string; expiresAt: string } | null;
  details: ReviewDetails | null;
  text: string | null;
  submittedAnswer: unknown;
}

/**
 * One submission, composed for the screen that decides it.
 *
 * The authorisation is the first half of this handler and deliberately not the engine's:
 * the engine authorises nothing, so a school id it is handed is a school id it serves.
 * What makes someone a reviewer is a group assignment live at the moment of submission,
 * which only organization-service can answer — and the answer is asked for twice, once
 * about then and once about now, so that a stand-in whose window has closed can still read
 * the work while being refused the verdict with a reason (`DATA_MODEL.md` §3).
 *
 * Nothing here turns a readable submission into an error. A breakdown the validator could
 * not build, an exercise its author has since deleted — both come back as a 200 the screen
 * can draw and decide on (criteria 20 and 21), because a teacher facing a 500 has no way
 * to unblock the learner waiting behind it.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const school = request.nextUrl.searchParams.get('school');
  if (!school) {
    return NextResponse.json({ error: 'school is required' }, { status: 400 });
  }

  const scope = await resolveReviewScope(school);
  if (scope instanceof NextResponse) return scope;

  let submission: EngineSubmission;
  try {
    submission = await serverFetch<EngineSubmission>({
      service: 'exercises',
      path: `/internal/attempts/${id}/review`,
      directBaseUrl: env.EXERCISE_SERVICE_INTERNAL_URL,
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
      anonymous: true,
      query: { schoolId: scope.schoolId },
      expectedErrorStatuses: [404],
    });
  } catch {
    // The engine answers 404 both for "no such attempt" and "not this school's", and the
    // distinction is not one this route should reveal either.
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const access = await authorizeSubmission(scope, {
    groupId: submission.groupId,
    submittedAt: submission.submittedAt,
  });
  if (!access.read) return refuseSubmission(access.reason ?? 'not_a_reviewer');

  const people = await fetchProfileSummaries(
    [
      submission.userId,
      submission.lock?.teacherId,
      submission.previous?.reviewerId,
      submission.decision?.reviewerId,
    ].filter((value): value is string => Boolean(value)),
  );

  const [sla, groupNames] = await Promise.all([
    buildSlaMap(scope.schoolId, submission.containerId ? [submission.containerId] : []),
    fetchGroupNames(scope.schoolId),
  ]);

  const slaHours = sla.slaFor(submission.containerId);
  const ageHours = submission.submittedAt === null ? 0 : hoursSince(submission.submittedAt);
  const named = (verdict: EngineVerdict | null): ReviewVerdictRecord | null =>
    verdict === null
      ? null
      : { ...verdict, reviewerName: people[verdict.reviewerId]?.displayName ?? null };

  const body: ReviewSubmission = {
    id: submission.attemptId,
    status: submission.status,
    student: {
      id: submission.userId,
      name: people[submission.userId]?.displayName ?? null,
      groupName: submission.groupId ? (groupNames[submission.groupId] ?? null) : null,
    },
    exercise: {
      id: submission.exerciseId,
      // The snapshot first: it is what the learner was actually given, and it is all
      // there is once the author has deleted the exercise.
      title: submission.path?.exercise ?? null,
      type: submission.templateCode,
      path: {
        course: submission.path?.course ?? null,
        lesson: submission.path?.module ?? null,
      },
      available: submission.exerciseAvailable,
      contentLang: submission.targetLanguage,
    },
    submittedAt: submission.submittedAt,
    ageHours,
    slaHours,
    overdue: slaHours === null ? false : isOverdue(ageHours, slaHours),
    attemptNo: submission.attemptNo,
    previous: named(submission.previous),
    decision: named(submission.decision),
    lock: submission.lock
      ? {
          teacherId: submission.lock.teacherId,
          teacherName: people[submission.lock.teacherId]?.displayName ?? null,
          expiresAt: submission.lock.expiresAt,
        }
      : null,
    details: submission.details,
    text: submission.text,
    submittedAnswer: submission.submittedAnswer,
    canDecide: access.write,
  };

  return NextResponse.json(body);
}

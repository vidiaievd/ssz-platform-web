import 'server-only';

import { NextResponse } from 'next/server';

import type { ReviewScope } from './review-scope';
import { reviewScopeAt } from './review-scope';

/** Administrators hold no queue but see, and may decide, everything in their school. */
const SCHOOL_WIDE_ROLES = ['OWNER', 'ADMIN', 'MANAGER'] as const;

export interface SubmissionSubject {
  /** The learner's group at submission time. Null — nobody's group, so nobody's queue. */
  groupId: string | null;
  /** When it was handed in. The rule is evaluated at this instant, not at now. */
  submittedAt: string | null;
}

/**
 * May this caller open this submission, and may they decide it?
 *
 * The two answers are separate on purpose (`DATA_MODEL.md` §3). Reading is settled at the
 * moment of submission: a stand-in who covered a fortnight in June owns what came in
 * during it, and a teacher added to the group last week does not — the work was never
 * theirs, and the comment they would write would arrive from a stranger.
 *
 * Writing asks the same question again about *now*. A substitution that has since run out
 * still shows its holder the work, and refuses the verdict with a reason: the group has
 * moved on to someone else, and a comment landing from a teacher who left a month ago is
 * worse for the learner than a clear refusal is for the reviewer. Silence would be worst
 * of all, which is why the expired window has its own code rather than a generic 403.
 */
export async function authorizeSubmission(
  scope: ReviewScope,
  subject: SubmissionSubject,
): Promise<{ read: boolean; write: boolean; reason: 'not_a_reviewer' | 'window_expired' | null }> {
  if (SCHOOL_WIDE_ROLES.includes(scope.role as (typeof SCHOOL_WIDE_ROLES)[number])) {
    return { read: true, write: true, reason: null };
  }

  // No group means no reviewers at all — the learner is outside the rule, and oversight
  // (46) is where that submission is picked up, by someone with a school-wide role.
  if (subject.groupId === null) {
    return { read: false, write: false, reason: 'not_a_reviewer' };
  }

  const at = subject.submittedAt ?? new Date().toISOString();
  const then = await reviewScopeAt(scope.schoolId, scope.teacherId, at);
  if (!then.groupIds.includes(subject.groupId)) {
    return { read: false, write: false, reason: 'not_a_reviewer' };
  }

  const stillHolds = scope.groupIds.includes(subject.groupId);
  return {
    read: true,
    write: stillHolds,
    reason: stillHolds ? null : 'window_expired',
  };
}

/** The refusal itself, so every route in the subsystem words it the same way. */
export function refuseSubmission(reason: 'not_a_reviewer' | 'window_expired'): NextResponse {
  return NextResponse.json(
    {
      error: reason === 'window_expired' ? 'Your assignment to this group has ended' : 'Forbidden',
      code: reason,
    },
    { status: 403 },
  );
}

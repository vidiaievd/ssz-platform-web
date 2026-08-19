/**
 * "Мои работы" — what a learner handed in and what came back (plan 47, screen E).
 *
 * Everything here is either the learner's own doing or a person's word to them. What the
 * teacher's side holds — the answer key, the validator's breakdown, per-item notes not
 * released to the learner — has no shape in this file, because it never travels this way
 * (invariant 1).
 */

import type { AttemptStatus } from '@/features/student/exercises/types/attempts';

export type MySubmissionStatus = 'pending' | 'returned' | 'approved';

/** Which slice of the list the screen is asking for. */
export type MySubmissionsFilter = 'all' | MySubmissionStatus;

/** The teacher's word on one submission, as the learner may read it. */
export interface MySubmissionDecision {
  verdict: 'approved' | 'returned';
  teacherId: string;
  /** `null` when the directory could not name them — a verdict still stands unsigned. */
  teacherName: string | null;
  at: string;
  comment: string | null;
}

export interface MySubmission {
  id: string;
  exerciseId: string;
  /**
   * The template the work was done in, as the engine snapshotted it on the attempt.
   *
   * The card forks on it (47.3): an essay is written again in place, everything else is
   * handed back to the runner it was typed in. Kept as a plain string rather than a union
   * because a template this screen has never heard of must fall somewhere sensible rather
   * than fail to type-check a list.
   */
  exerciseType: string;
  /** The language the work was answered in — what a second attempt is started under. */
  targetLanguage: string;
  /** Course · lesson · exercise as they read when the work was started (44.4). */
  exerciseTitle: string | null;
  course: string | null;
  lesson: string | null;
  containerId: string | null;
  submittedAt: string;
  status: MySubmissionStatus;
  /** Which try this is, after a returned verdict. `1` for a first hand-in. */
  attemptNo: number;
  /**
   * When an answer is due, on `pending` rows that fall under a promise (invariant 2).
   *
   * `null` means nobody made one — neither the school nor the course set a response time —
   * and the screen says so rather than inventing a date the school never agreed to.
   */
  expectedResponseBy: string | null;
  decision: MySubmissionDecision | null;
  /** Whether "hand in again" would resume *this* row rather than a later one (47.1). */
  canResubmit: boolean;
}

/**
 * How much is waiting and how much came back.
 *
 * Only on an unfiltered list: a page of `status=returned` knows nothing about what is
 * pending, and a subtitle drawn from it would be counting the filter rather than the
 * learner's work. `partial` says the counts describe the loaded page and not the whole
 * list, the same way the teacher's queue reads "9+" rather than "9".
 */
export interface MySubmissionsSummary {
  pending: number;
  returned: number;
  partial: boolean;
}

export interface MySubmissionsResponse {
  summary: MySubmissionsSummary | null;
  items: MySubmission[];
  nextCursor: string | null;
}

/**
 * The verdict a second attempt is being made against, read back in the runner (47.3).
 *
 * Deliberately thinner than {@link MySubmission}: the banner over an exercise needs the
 * teacher's words and their name, and nothing that would put the learner's previous answer
 * — or anything derived from the key — on a screen they are about to answer on.
 */
export interface ReturnedVerdict {
  attemptId: string;
  exerciseId: string;
  /** The attempt's own state. Only `RETURNED` means "you are here to redo this". */
  status: AttemptStatus;
  comment: string | null;
  teacherName: string | null;
  at: string | null;
}

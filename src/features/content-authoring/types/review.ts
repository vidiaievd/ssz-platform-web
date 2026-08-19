import type {
  SpanOutcome,
  SpanType,
  StrayEdit,
  StudentEdits,
  Verdict as ErrorCorrectionVerdict,
} from '@/lib/shared-kernel/error-correction';
import type { DiffToken, GuardHit, Routing, Verdict } from '@/lib/shared-kernel/translate';

import type { CourseExerciseRef } from '../lib/collect-course-exercises';

/**
 * The teacher's side of a submission — plan 42, phase 8.
 *
 * The queue is written over attempts in `ROUTED_FOR_REVIEW` whatever template produced
 * them, so what is shared sits in `ReviewItemCommon` and each template adds its own
 * reading of one item below it. Both vocabularies agree on the two things the screen and
 * the server turn on: a per-item `routing`, whose `pass` the server credits without
 * asking anyone, and a `verdict` to sort by.
 */
export interface ReviewItemCommon {
  itemId: string;
  similarity: number;
  routing: Routing;
  /**
   * The sentence the learner was given — to translate, or to repair.
   *
   * It comes down with the breakdown rather than being fetched beside it: the engine
   * already has the exercise open to recompute the judgement, and a reviewer reading a
   * diff without the question above it is guessing at the task. Null on a submission
   * graded before the engine sent it (August 2026) — the breakdown is recomputed on every
   * read, so that window closes by itself.
   */
  prompt?: string | null;
  /** The author's aside to whoever marks this. Never reaches a learner (criterion 13). */
  note?: string | null;
}

/** One sentence of a translate submission, as its validator reads it. */
export interface TranslateItemDetail extends ReviewItemCommon {
  verdict: Verdict;
  /** The accepted translation the answer was compared against. Teacher-only. */
  ref: string;
  submitted: string;
  tokens: DiffToken[];
  missing: GuardHit[];
  banned: GuardHit[];
}

/** One mistake the author planted, and what the learner did about it. */
export interface ErrorCorrectionSpanDetail {
  key: string;
  type: SpanType;
  state: SpanOutcome;
  /** The faulty words. Empty when a word is missing rather than wrong. */
  wrong: string;
  /** What the answer key has instead. Empty when a word is superfluous. */
  fix: string;
  /** What the learner's edits produced across this span alone. */
  submitted: string;
  note: string;
}

/**
 * One sentence of an error-correction submission.
 *
 * `edits` rather than only `built`: which mistake the learner actually found cannot be
 * recovered from a rewritten sentence, and that is the question a teacher is answering.
 */
export interface ErrorCorrectionItemDetail extends ReviewItemCommon {
  verdict: ErrorCorrectionVerdict;
  /** The sentence the learner's edits produced. */
  built: string;
  fixedSpans: number;
  totalSpans: number;
  spans: ErrorCorrectionSpanDetail[];
  /** Edits landing where the author planted no mistake. */
  stray: StrayEdit[];
  edits: StudentEdits | null;
}

export type ReviewItemDetail = TranslateItemDetail | ErrorCorrectionItemDetail;

export interface ReviewDetails<TItem extends ReviewItemDetail = ReviewItemDetail> {
  totalItems: number;
  routedItems: number;
  passedItems: number;
  items: TItem[];
}

export interface ReviewQueueEntry {
  attemptId: string;
  userId: string;
  /** Which exercise this submission belongs to — the only grouping a course inbox has. */
  exerciseId: string;
  templateCode: string;
  submittedAnswer: unknown;
  submittedAt: string | null;
  timeSpentSeconds: number;
  selfChecksUsed: number;
  answersRevealed: boolean;
  /**
   * The machine's reading of this submission, recomputed when the queue was opened.
   * `null` when the exercise could not be read — the submission is still reviewable, just
   * without a diff to lean on. Which member of the union it is follows `templateCode`.
   */
  details: ReviewDetails | null;
}

export interface ReviewQueueResponse {
  items: ReviewQueueEntry[];
  total: number;
  limit: number;
  offset: number;
  /**
   * Who the submissions are from, keyed by user id and joined in by the BFF — neither
   * exercise-engine nor content-service holds a name. An id missing from here is one the
   * directory could not answer for, which the card shows as the shortened id it always
   * did: a queue is worth opening without names, and worth nothing unopened.
   */
  learners: Record<string, LearnerSummary>;
}

export interface LearnerSummary {
  userId: string;
  displayName: string;
  avatarUrl?: string;
}

/**
 * The same queue across a whole course, plus the names the submissions hang under.
 *
 * The exercises travel with the queue because they are what the course tree knows and the
 * engine does not: an entry comes back keyed by `exerciseId`, and only the tree can say
 * which lesson that is, or what it is called.
 */
export interface CourseReviewQueueResponse extends ReviewQueueResponse {
  exercises: CourseExerciseRef[];
}

export interface ReviewDecision {
  itemId: string;
  approved: boolean;
  comment?: string;
}

export interface ReviewAttemptRequest {
  outcome: 'approved' | 'returned';
  decisions?: ReviewDecision[];
  comment?: string;
}

export interface ReviewAttemptResult {
  attemptId: string;
  status: 'SCORED' | 'RETURNED';
  score: number | null;
  approvedItems: number;
  totalItems: number;
}

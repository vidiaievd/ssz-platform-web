import type {
  SpanOutcome,
  SpanType,
  StrayEdit,
  StudentEdits,
  Verdict as ErrorCorrectionVerdict,
} from '@/lib/shared-kernel/error-correction';
import type { DiffToken, GuardHit, Routing, Verdict } from '@/lib/shared-kernel/translate';

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

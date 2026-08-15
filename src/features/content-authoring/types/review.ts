import type { DiffToken, GuardHit, Routing, Verdict } from '@/lib/shared-kernel/translate';

/**
 * The teacher's side of a submission — plan 42, phase 8.
 *
 * Deliberately not translate-specific in shape: the queue is written over attempts in
 * `ROUTED_FOR_REVIEW` whatever template produced them, so `error_correction` can be shown
 * in the same screen by teaching one component to read its details. What is translate's
 * own is `ReviewItemDetail`, which mirrors what the translate validator produces.
 */
export interface ReviewItemDetail {
  itemId: string;
  verdict: Verdict;
  similarity: number;
  /** The accepted translation the answer was compared against. Teacher-only. */
  ref: string;
  submitted: string;
  tokens: DiffToken[];
  missing: GuardHit[];
  banned: GuardHit[];
  routing: Routing;
}

export interface ReviewDetails {
  totalItems: number;
  routedItems: number;
  passedItems: number;
  items: ReviewItemDetail[];
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
   * without a diff to lean on.
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

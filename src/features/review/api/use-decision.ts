'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ReviewQueueCount, ReviewQueueFilters } from '../types';

import { reviewKeys } from './keys';

/** The three the screen offers; the engine folds the middle one into an approval. */
export type ReviewVerdict = 'approved' | 'approved_comment' | 'returned';

export interface ReviewDecisionInput {
  verdict: ReviewVerdict;
  comment: string;
  sentenceComments: Record<string, string>;
  /**
   * Rubric marks 0-3 by criterion id, for a submission graded that way.
   *
   * Judgements, not a score, and `verdict` above is ignored for these: the engine derives
   * the outcome from `Σ mark × weight` against the rubric frozen on the attempt, so a
   * screen whose settings had gone stale cannot deliver a verdict the marks do not
   * support. The invariant "no score is entered by hand" holds exactly as before.
   */
  rubricMarks?: Record<string, number>;
}

/** A colleague answered first — everything the banner has to name (criterion 24). */
export interface ReviewConflict {
  by: string;
  byName: string | null;
  verdict: 'approved' | 'returned';
  at: string;
}

/**
 * A refusal the screen has a shape for, rather than a message it can only print.
 *
 * The two that matter are told apart by `status`: 409 goes to the banner and turns the
 * panel read-only, 422 goes inline beside the comment field. Anything else is an error
 * like any other and says so.
 */
export class ReviewDecisionError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    readonly conflict: ReviewConflict | null,
  ) {
    super(`Review decision failed: ${status}`);
    this.name = 'ReviewDecisionError';
  }
}

export interface ReviewDecisionResult {
  /** The next submission in the queue as the reviewer has it arranged; null when empty. */
  nextId: string | null;
}

/**
 * Send a verdict, and learn where to go next.
 *
 * The queue and the badge are invalidated rather than patched, with one exception: the
 * count is decremented on the spot, because it is the one number a teacher watches go
 * down as they work and a refetch's worth of delay makes a marking pass feel like it is
 * not registering. The refetch that follows corrects it either way, so an optimistic
 * number that turns out wrong is wrong for a moment rather than until reload.
 *
 * The submission itself is invalidated too. After a conflict that read comes back
 * carrying the colleague's verdict, which is what makes the panel go read-only on its own
 * rather than on a flag this mutation would have to keep.
 */
export function useReviewDecision(school: string, id: string, filters: ReviewQueueFilters) {
  const queryClient = useQueryClient();

  return useMutation<ReviewDecisionResult, ReviewDecisionError, ReviewDecisionInput>({
    mutationFn: async (input) => {
      const response = await fetch(
        `/api/review/submissions/${id}/decision?school=${encodeURIComponent(school)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...input, filters }),
        },
      );

      if (response.ok) return (await response.json()) as ReviewDecisionResult;

      const body = (await response.json().catch(() => ({}))) as {
        code?: string;
        by?: string;
        byName?: string | null;
        verdict?: 'approved' | 'returned';
        at?: string;
      };

      throw new ReviewDecisionError(
        response.status,
        body.code ?? null,
        response.status === 409 && body.by
          ? {
              by: body.by,
              byName: body.byName ?? null,
              verdict: body.verdict ?? 'approved',
              at: body.at ?? new Date().toISOString(),
            }
          : null,
      );
    },

    onSuccess: () => {
      queryClient.setQueryData<ReviewQueueCount>(reviewKeys.count(school), (current) =>
        current === undefined ? current : { ...current, pending: Math.max(current.pending - 1, 0) },
      );
      void queryClient.invalidateQueries({ queryKey: reviewKeys.queues() });
      void queryClient.invalidateQueries({ queryKey: reviewKeys.counts() });
    },

    onError: (error) => {
      if (error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: reviewKeys.submission(school, id) });
        void queryClient.invalidateQueries({ queryKey: reviewKeys.queues() });
      }
    },
  });
}

/**
 * A model's review of a learner's own work (plan 79, step 2.3).
 *
 * Only for the learner nobody reviews: no school, the work read by a model on their own
 * plan. Everything here is written to the learner — the model, its prompt and its cost stay
 * in the engine and ai-service, and the screen must label what it shows as a review by AI,
 * never as a teacher's word.
 */

/** One remark on one item of the answer. */
export interface AiReviewRemark {
  /** The sentence, question, or `text` of an essay the remark is about. */
  itemId: string;
  /** Position of that item in the exercise, from 0. */
  sentenceIndex: number;
  /**
   * What the remark is about — `grammar`, `lexis`, `meaning`, `alternative` (the wording is
   * right too), `task`, `structure`, `content`. Kept as a string: an aspect this screen has
   * not heard of falls back to a plain remark rather than failing the review.
   */
  aspect: string;
  /** The words of the answer it points at; `null` for a remark on the answer as a whole. */
  fragment: string | null;
  comment: string;
  suggestion: string | null;
}

/** A mark the model gave out of the essay's rubric, with why. */
export interface AiReviewMark {
  criterionId: string;
  /**
   * The criterion's name as frozen on the attempt with the rubric, so a screen that has no
   * rubric of its own can still say what the mark is for. `null` when it cannot be found.
   */
  criterionName: string | null;
  mark: 0 | 1 | 2 | 3;
  reason: string;
}

export interface AiReview {
  outcome: 'approved' | 'returned';
  items: AiReviewRemark[];
  /** The model's word on the answer as a whole — also the attempt's `reviewComment`. */
  summary: string | null;
  /** For an essay graded out of a rubric; `null` otherwise. */
  marks: AiReviewMark[] | null;
  reviewedAt: string;
  /** When the learner said the review is wrong; `null` until they do. */
  disputedAt: string | null;
}

export interface DisputeAiReviewRequest {
  /** Why, in the learner's words. Optional; at most 1000 characters. */
  reason?: string;
}

export interface DisputeAiReviewResponse {
  /** The first press — a repeat answers with the same time. */
  disputedAt: string;
}

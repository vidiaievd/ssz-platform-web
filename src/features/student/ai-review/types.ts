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

/**
 * One step of the reading check, in passage order (the kernel's `ReadingOp`): a passage word
 * read, read as another word, or missed; or a word heard that is not in the passage. `i` is
 * the passage word's index; a `read` may cover `n` passage words the recognizer glued.
 */
export type AiReadingOp =
  | { k: 'read'; i: number; n: number; heard: string; focus: boolean }
  | { k: 'misread'; i: number; expected: string; heard: string; focus: boolean }
  | { k: 'missed'; i: number; expected: string; focus: boolean }
  | { k: 'extra'; heard: string };

/** How a passage word was pronounced — Azure's own alignment, feedback only. */
export interface AiPronouncedWord {
  text: string;
  /** 0–100. */
  accuracy: number;
  error: 'none' | 'mispronunciation' | 'omission' | 'insertion';
}

/** Pronunciation scores, 0–100 — never part of the verdict (plan 82 §2.3). */
export interface AiPronunciation {
  accuracy: number;
  fluency: number;
  completeness: number;
  /** Null where the language has none (`nb`). */
  prosody: number | null;
  words: AiPronouncedWord[];
}

/** What the machine heard in one prompt's recording, and the check the verdict stood on. */
export interface AiReadingPrompt {
  itemId: string;
  /** The recognizer's words as one string. */
  transcript: string;
  ops: AiReadingOp[];
  /** Passage words, and those read. */
  total: number;
  read: number;
  /** Whole percent, rounded down — what the pass mark is measured against. */
  percent: number;
  passed: boolean;
  /** Only on plans that include it; `null` otherwise. */
  pronunciation: AiPronunciation | null;
  /** Over the speech heard, when the author asks for the pace (`review.ai.fluency`); a hint. */
  wordsPerMinute: number | null;
}

/** A `read_aloud` work as the machine checked it (plan 82, step 7). */
export interface AiReading {
  /** The share of a prompt's words it had to read, as ruled. */
  passPercent: number;
  /** In the exercise's order. */
  prompts: AiReadingPrompt[];
  /** Passed in an earlier try and not checked again (plan 70, phase 11b). */
  carriedItemIds: string[];
}

export interface AiReview {
  outcome: 'approved' | 'returned';
  items: AiReviewRemark[];
  /** The model's word on the answer as a whole — also the attempt's `reviewComment`. */
  summary: string | null;
  /** For an essay graded out of a rubric; `null` otherwise. */
  marks: AiReviewMark[] | null;
  /** For a `read_aloud` reading, checked by the machine; `null` for every other template. */
  reading: AiReading | null;
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

import type {
  SpanOutcome,
  SpanType,
  StrayEdit,
  StudentEdits,
  Verdict as ErrorCorrectionVerdict,
} from '@/lib/shared-kernel/error-correction';
import type { DiffToken, GuardHit, Routing, Verdict } from '@/lib/shared-kernel/translate';

/**
 * How one submission reads, item by item — the machine's half of a review.
 *
 * Written over attempts in `ROUTED_FOR_REVIEW` whatever template produced them, so what
 * is shared sits in `ReviewItemCommon` and each template adds its own reading of one item
 * below it. Both vocabularies agree on the two things the screen and the server turn on:
 * a per-item `routing`, whose `pass` the server credits without asking anyone, and a
 * `verdict` to sort by.
 *
 * These types stayed behind in `content-authoring` when the inbox moved to
 * `features/review` (step 45.10): they are the vocabulary of the *templates*, which is
 * what this feature owns, and both the review screen and the authoring previews read
 * them. Everything about the queue itself lives in `features/review/types`.
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

/**
 * One must-cover point of a `writing_task`, as the engine reads it against the text.
 *
 * Both facts are kept because they disagree usefully. `hit` comes from the point's
 * keywords, which are the author's guess at how the point would be phrased; `ticked` is
 * the student saying they covered it. A point ticked but not hit is either a student who
 * phrased it another way or keywords that never matched anyone — and which of the two it
 * is, is exactly what the teacher is reading the text to find out.
 */
export interface WritingTaskPointDetail {
  id: string;
  text: string;
  required: boolean;
  /** A keyword for this point was phrased somewhere in the text. Teacher-only. */
  hit: boolean;
  /** The student ticked it off their own checklist. Never affects a verdict. */
  ticked: boolean;
}

/**
 * What the machine can say about a free text — which is facts, and no judgement.
 *
 * Deliberately not a `ReviewDetails`: there are no items, because a text is not marked
 * sentence by sentence, and a shape with an empty `items` array would draw the empty
 * slots of a diff this template never produces (criterion 22). Every number here is
 * measured rather than graded — `writing-task.validator.ts` refuses to suggest a mark,
 * and the rubric on the screen starts blank.
 */
export interface WritingTaskDetails {
  totalItems: number;
  passedItems: number;
  wordCount: number;
  paragraphs: number;
  uniqueWords: number;
  /** Against the author's range: `short`, `ok`, `long` — recorded, never enforced. */
  length: 'empty' | 'short' | 'ok' | 'long';
  hitCount: number;
  neededCount: number;
  points: WritingTaskPointDetail[];
}

import type { SelfCheckFeedback } from '@/lib/shared-kernel/error-correction';
import type { SelfCheckFeedback as TranslateSelfCheckFeedback } from '@/lib/shared-kernel/translate';
import type { GapKey, StudentProjection } from '@/lib/shared-kernel/wordbank-gapfill';

/**
 * The exercise-engine attempt API, as this client uses it.
 *
 * Until now the reader never spoke to the engine at all: it fetched the exercise with
 * its answers and graded in the browser. That is workable while the answers sit in a
 * separate key the reader can simply not render — but `word_bank_gap_fill` keeps its
 * answers inside the sentences, so for this template the grading has to happen where
 * the answers are.
 */

export type CheckMode = 'PRACTICE' | 'GRADED';

export interface StartAttemptRequest {
  /** Language of the instructions, not of the answer. */
  language: string;
  mode?: CheckMode;
}

export interface StartAttemptResponse {
  attemptId: string;
  templateCode: string;
  targetLanguage: string;
  difficultyLevel: string;
  checkMode: CheckMode;
  /**
   * Shape depends on `templateCode`. For `word_bank_gap_fill` this is the masked
   * projection — the gapped words are already gone — and never the stored content.
   */
  exerciseContent: unknown;
  /** `null` for templates that withhold them, which is all of them in GRADED mode. */
  expectedAnswers: unknown;
  answerSchema: unknown;
  checkSettings: Record<string, unknown>;
}

/** `exerciseContent` when `templateCode` is `word_bank_gap_fill`. */
export type GapFillAttemptContent = StudentProjection;

export interface GapFillPlacement {
  gapKey: GapKey;
  word: string;
}

export interface SubmitAnswerRequest {
  submittedAnswer: unknown;
  timeSpentSeconds: number;
  locale?: string;
}

export interface SubmitAnswerResponse {
  attemptId: string;
  correct: boolean;
  score: number | null;
  requiresReview: boolean;
  feedback: { summary: string; hints?: string[]; correctAnswer?: unknown };
  /** Validator output. For gap-fill, a verdict and an explanation per gap. */
  details?: unknown;
}

/** `details` when the template is `word_bank_gap_fill`. */
export interface GapFillSubmitDetails {
  totalGaps: number;
  correctGaps: number;
  gaps: Array<{ gapKey: GapKey; correct: boolean; explanation: string | null }>;
}

/**
 * `details` when the template is `translate_*` — where each sentence ended up.
 *
 * Deliberately thin. The validator writes a great deal more per sentence (the variant
 * compared against, the diff, the rules tripped), all of it for the teacher queue and
 * all of it a way to read the answer key; the engine strips it before answering the
 * browser. Routing is what the learner is owed: this sentence matched and is done, that
 * one is with a teacher.
 */
export interface TranslateSubmitDetails {
  totalItems: number;
  passedItems: number;
  items: Array<{ itemId: string; routing: 'pass' | 'teacher' }>;
}

export type AttemptStatus =
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'SCORED'
  | 'ROUTED_FOR_REVIEW'
  | 'ABANDONED';

/** An attempt read back after the fact — the record, not the session. */
export interface AttemptRecord {
  id: string;
  exerciseId: string;
  templateCode: string;
  status: AttemptStatus;
  checkMode: CheckMode;
  score: number | null;
  passed: boolean | null;
  answersRevealed: boolean;
  /** What the learner sent. Shape follows `templateCode`. */
  submittedAnswer: unknown;
  /** Validator output. `null` on GRADED attempts — the engine withholds it there. */
  validationDetails: unknown;
  submittedAt: string | null;
  scoredAt: string | null;
}

/** `submittedAnswer` when the template is `word_bank_gap_fill`. */
export interface GapFillSubmittedAnswer {
  placements: GapFillPlacement[];
}

export interface LastAttemptResponse {
  attempt: AttemptRecord | null;
}

/**
 * "How am I doing?", asked mid-attempt by the two templates that offer it.
 *
 * A server round-trip for the same reason grading is: the answer is derived from the
 * key, and the key never reaches the browser. What comes back is counts and mistake
 * types for `error_correction`, and — for `translate_*` — a verdict per sentence with
 * the key's own words masked out of the diff.
 */
export interface SelfCheckRequest {
  /**
   * The work so far, in the shape a submission carries: `{ items: { <id>: edits } }`
   * for `error_correction`, `{ answers: [{ itemId, text }] }` for `translate_*`.
   */
  draftAnswer: unknown;
}

/** Whose attempt it was, and what asking cost — the same for either template. */
export interface SelfCheckEnvelope {
  attemptId: string;
  /** Including the one just spent. */
  checksUsed: number;
  checksLeft: number;
}

export interface ErrorCorrectionSelfCheckResponse extends SelfCheckEnvelope, SelfCheckFeedback {
  templateCode: 'error_correction';
}

export interface TranslateSelfCheckResponse extends SelfCheckEnvelope, TranslateSelfCheckFeedback {
  templateCode: 'translate_to_target' | 'translate_from_target';
}

/**
 * Discriminated by `templateCode`, because the two payloads share nothing but their
 * `items` key and mean entirely different things by it. A runner that reads the wrong
 * half is a bug this union turns into a compile error.
 */
export type SelfCheckResponse = ErrorCorrectionSelfCheckResponse | TranslateSelfCheckResponse;

export interface RevealAnswersResponse {
  attemptId: string;
  answers: Array<{ gapKey: GapKey; label: string; word: string; why: string | null }>;
  attemptClosed: boolean;
}

/**
 * «Check» before hand-in — the rehearsal with a model (platform plan 84, web step 8).
 *
 * exercise-engine `POST /exercises/:exerciseId/attempts/:attemptId/check`; the contract is plan
 * 84 «Ход работ», row 5. A rehearsal changes nothing: the attempt stays in progress, no event
 * goes out, no card is rated and no progress moves — only the hand-in does that.
 */

export type FeedbackKind =
  | 'grammar'
  | 'lexis'
  | 'spelling'
  | 'pronunciation'
  | 'fluency'
  | 'content';

export interface FeedbackItem {
  kind: FeedbackKind;
  original: string | null;
  suggestion: string | null;
  explanation: string;
  severity: 'minor' | 'major';
}

export interface FeedbackWord {
  text: string;
  passageIndex: number | null;
  /** 0–100; null when the provider gave no pronunciation scores. */
  accuracy: number | null;
}

/** The model's reading of the work (platform `AiFeedback`, minus what the web does not draw). */
export interface Feedback {
  summary: string;
  items: FeedbackItem[];
  words: FeedbackWord[];
}

/** What the school's limits leave. `null` — no limit, or not read. */
export interface PrecheckRemaining {
  exercise: number | null;
  learnerChecksApprox: number | null;
}

export type PrecheckAi =
  | { status: 'ok' }
  /** `exercise_limit`, `learner_limit`, `pool_empty`, `unaskable`, `not_available`, … */
  | { status: 'refused'; reason: string }
  | { status: 'failed'; errorCode: string }
  /** `key_settles`, or why this school's learner cannot ask a model. */
  | { status: 'not_asked'; reason: string };

export interface ReadingPrompt {
  itemId: string;
  percent: number;
  passed: boolean;
}

export interface PrecheckResult {
  /** The free, key-based half (`error_correction`, `translate_*`); the template reads it. */
  selfCheck: unknown | null;
  ai: PrecheckAi;
  feedback: Feedback | null;
  /** `read_aloud`: how much of each passage the speech model heard read. */
  reading: { passPercent: number; prompts: ReadingPrompt[] } | null;
  remaining: PrecheckRemaining | null;
}

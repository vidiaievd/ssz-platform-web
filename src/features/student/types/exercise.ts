export type ExerciseType = 'cloze' | 'multiple_choice' | 'free_text' | 'pronunciation';

export type AttemptVerdict = 'correct' | 'partial' | 'incorrect';

export interface AttemptResult {
  verdict: AttemptVerdict;
  /** Canonical answer shown after an incorrect/partial attempt. */
  correctAnswer?: string | string[];
  explanation?: string;
  canRetry: boolean;
}

/** Input passed to submitAttemptAction. `content` is stub-only; production validates server-side. */
export interface SubmitAttemptInput {
  exerciseId: string;
  type: ExerciseType;
  answer: unknown;
  /** Stub only — the real backend holds the answers; remove this field when wiring to the service. */
  content: Record<string, unknown>;
}

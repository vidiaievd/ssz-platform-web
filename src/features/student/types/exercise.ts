export type ExerciseType = 'cloze' | 'multiple_choice' | 'free_text' | 'pronunciation';

export type AttemptVerdict = 'correct' | 'partial' | 'incorrect';

export interface AttemptResult {
  verdict: AttemptVerdict;
  /** Canonical answer shown after an incorrect/partial attempt. */
  correctAnswer?: string | string[];
  explanation?: string;
  canRetry: boolean;
  /** True when a human reviewer must grade the answer (e.g. free-text). */
  requiresReview?: boolean;
}

export interface SubmitAttemptInput {
  exerciseId: string;
  type: ExerciseType;
  answer: unknown;
}

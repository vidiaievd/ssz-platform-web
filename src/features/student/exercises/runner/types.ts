export type RunnerMode = 'practice' | 'graded';
export type RunnerPhase = 'answering' | 'feedback';
export type FeedbackDensity = 'minimal' | 'rich';

/** Six user-facing states derived from runtime values. */
export type RunnerVisualState =
  | 'unanswered'
  | 'correct'
  | 'incorrect'
  | 'submitted'
  | 'loading'
  | 'error';

/**
 * Pure function: derive the user-facing visual state from runtime values.
 * - Loading / error gate everything else.
 * - Graded mode never reveals correctness: feedback phase → 'submitted'.
 * - Practice: feedback + ok → 'correct' / 'incorrect'.
 * - Answering phase (any mode) → 'unanswered'.
 */
export function deriveVisualState(
  phase: RunnerPhase,
  mode: RunnerMode,
  ok: boolean | null,
  isLoading: boolean,
  isError: boolean,
): RunnerVisualState {
  if (isLoading) return 'loading';
  if (isError) return 'error';
  if (phase === 'answering') return 'unanswered';
  if (mode === 'graded') return 'submitted';
  return ok === true ? 'correct' : 'incorrect';
}

/** CSS color string for the practice mode accent (sage teal). */
export const PRACTICE_ACCENT = 'var(--ssz-color-primary-500)' as const;
/** CSS color string for the graded mode accent (warm amber). */
export const GRADED_ACCENT = 'var(--ssz-color-secondary-600)' as const;

/** Returns the mode-driven accent CSS color string. */
export function modeAccent(mode: RunnerMode): string {
  return mode === 'graded' ? GRADED_ACCENT : PRACTICE_ACCENT;
}

/**
 * Returns a very-light-tinted fill version of the mode accent (~7% opacity),
 * used for selected-but-not-revealed option backgrounds.
 */
export function modeAccentSoft(mode: RunnerMode): string {
  return mode === 'graded'
    ? 'oklch(0.57 0.105 82 / 0.07)'
    : 'oklch(0.62 0.105 168 / 0.07)';
}

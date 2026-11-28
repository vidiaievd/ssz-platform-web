import type { SubmitAnswerResponse } from '../types/attempts';

/**
 * Whether a submit counted as passed: the engine's `passed`, else `correct` (engines before
 * plan 90 OQ-S3 s11). A set over the pass mark with an item wrong is passed, not wrong.
 */
export function submitPassed(response: Pick<SubmitAnswerResponse, 'correct' | 'passed'>): boolean {
  return response.passed ?? response.correct;
}

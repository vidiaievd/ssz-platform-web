import {
  DEFAULT_FLOW,
  DEFAULT_HINTS,
  type StudentProjection,
} from '@/lib/shared-kernel/error-correction';

/**
 * Accept the exercise only if what arrived is the masked projection.
 *
 * The runner has one payload it can work with, and one payload it must refuse. The
 * projection carries `words` per item, because every index in an edit points into that
 * array; the stored document does not. So a missing `words` is not a small gap to
 * paper over by tokenising here — it means the server did not run the masking at all,
 * and a server that did not mask also sent `expectedAnswers`, which is the exercise's
 * answer key sitting in the browser.
 *
 * Rendering it anyway would work — the sentences are there — and would quietly hand the
 * learner an exercise whose answers are one devtools tab away. So this returns `null`,
 * the solver shows its error state, and the deployment that caused it stays visible.
 *
 * In practice that means an `exercise-engine` older than the masking (phase 2 of plan
 * 41). Rebuilding the image is the fix; refusing is what keeps the wait honest.
 */
export function readStudentProjection(value: unknown): StudentProjection | null {
  if (typeof value !== 'object' || value === null) return null;

  const raw = value as Partial<StudentProjection>;
  if (!Array.isArray(raw.items)) return null;
  if (raw.mode !== 'sentences' && raw.mode !== 'passage') return null;

  const items = raw.items.map((item) => {
    if (typeof item !== 'object' || item === null) return null;
    const { id, wrong, words } = item as StudentProjection['items'][number];
    if (typeof id !== 'string' || typeof wrong !== 'string') return null;
    if (!Array.isArray(words) || words.some((word) => typeof word !== 'string')) return null;
    return item;
  });
  if (items.some((item) => item === null)) return null;

  return {
    ...raw,
    mode: raw.mode,
    note: typeof raw.note === 'string' ? raw.note : '',
    items: raw.items,
    // Settings are what the screen is arranged by, not what it is about: a projection
    // that lost one of them is still playable, and the defaults are the author's own
    // defaults rather than a guess.
    hints: { ...DEFAULT_HINTS, ...raw.hints },
    flow: { ...DEFAULT_FLOW, ...raw.flow },
  };
}

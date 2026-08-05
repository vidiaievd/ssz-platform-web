import type { SrsCardState } from '../types';

/** How loudly a glossed word is marked up in the reader. */
export type GlossIntensity = 'strong' | 'normal' | 'muted' | 'none';

/** Reader setting: which glossed words get decorated at all. */
export type GlossVisibility = 'all' | 'unknown' | 'off';

/**
 * Stability (in days) above which a word counts as retained and stops being
 * marked up. Picked empirically — roughly three weeks of retention is where a
 * word stops feeling new to the reader — and expected to be tuned once there is
 * lookup telemetry (plan 31 §E2).
 */
export const MATURE_STABILITY_DAYS = 21;

/**
 * Maps the learner's SRS state for a word onto how strongly the reader should
 * mark it. A word with no card is unseen, not known, so it gets the default
 * treatment rather than being hidden.
 */
export function getGlossIntensity(state?: SrsCardState, stability?: number): GlossIntensity {
  switch (state) {
    case undefined:
    case 'NEW':
      return 'normal';
    case 'LEARNING':
    case 'RELEARNING':
      return 'strong';
    case 'REVIEW':
      return (stability ?? 0) >= MATURE_STABILITY_DAYS ? 'none' : 'muted';
    case 'SUSPENDED':
      return 'none';
  }
}

/** Applies the reader's visibility setting on top of the SRS-derived intensity. */
export function resolveGlossIntensity(
  visibility: GlossVisibility,
  state?: SrsCardState,
  stability?: number,
): GlossIntensity {
  if (visibility === 'off') return 'none';
  if (visibility === 'all') return 'normal';
  return getGlossIntensity(state, stability);
}

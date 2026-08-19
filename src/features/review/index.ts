/**
 * The feature's public surface — client-safe by construction.
 *
 * `lib/sla-map.ts` and `lib/review-scope.ts` are deliberately absent: both are
 * `server-only`, and re-exporting them here would break the first client component that
 * imported anything at all from this barrel.
 */
export { AgeMark, useAgeWords } from './components/age-mark';
export { AgeSpread } from './components/age-spread';
export { ageRail, ageTextTone, ageTone, hoursSince, isOverdue, ratio } from './lib/age-scale';
export * from './types';

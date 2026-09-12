import type { Focus, Skill } from '@/lib/shared-kernel/skills/model';

/**
 * The learner's profile as the web sees it — plan 55 §6.
 *
 * The wire shape of analytics' `GET /internal/mastery/:userId`, with `lastAttemptAt`
 * left as the ISO string it arrives as: nothing on either surface formats it as a
 * date, and parsing it into a `Date` only to render "3 attempts" would be a
 * conversion that exists to be dropped.
 *
 * `skill` and `focus` carry `'unknown'` deliberately (§3.10): today nearly every
 * attempt lands in an unknown focus, because no `ContentRelation` rows are seeded,
 * and hiding those cells would leave both surfaces blank without saying why.
 */
export type MasterySkill = Skill | 'unknown';
export type MasteryFocus = Focus | 'unknown';

export interface MasteryCell {
  skill: MasterySkill;
  focus: MasteryFocus;
}

/**
 * What kind of weakness a cell is — decided in `weakestCells()`, never here.
 *
 * `null` is the fourth and honest answer: with no stability recorded, nothing tells
 * "forgets it" from "never learned it", and a screen must say the pair is weak without
 * claiming to know which.
 */
export type WeaknessReason = 'forgets' | 'never-knew' | 'watch';

/** A cell the profile is willing to speak about: it cleared `minWeightedSample`. */
export interface MasteryVerdict extends MasteryCell {
  successRateEwma: number;
  reason: WeaknessReason | null;
  meanStability: number | null;
  medianSecondsPerItem: number | null;
  attempts: number;
  weightedSample: number;
  lastAttemptAt: string;
}

/** A cell that was practised, but not enough for anything to be said about it. */
export interface MasteryUncertainCell extends MasteryCell {
  status: 'insufficient_data';
  attempts: number;
  weightedSample: number;
  /** How much more evidence the cell needs before it earns a verdict. */
  shortfall: number;
}

export interface MasteryProfile {
  userId: string;
  courseId: string | null;
  /** The bar a verdict was made under, reported so the surface can name it. */
  minWeightedSample: number;
  /** Weakest first. Only cells over the bar. */
  weakest: MasteryVerdict[];
  /** Attempted but unjudged, thinnest evidence first. */
  insufficient: MasteryUncertainCell[];
}

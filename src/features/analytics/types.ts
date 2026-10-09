import type { CellState } from '@/lib/shared-kernel/analytics';

/** What the service says about one unit of a group's course — DATA_MODEL §3.1. */
export interface GroupProgressUnit {
  unitId: string;
  no: number;
  title: string;
  items: number;
  /** `null` — the timetable could not be asked. Never a zero standing in for that. */
  delivered: {
    value: 0 | 0.5 | 1;
    lessons: number;
    lastHeldAt: string | null;
    linked: boolean;
  } | null;
  /** Whole percents. `null` — nobody in the group has a number for this unit. */
  absorbed: { median: number; p25: number; p75: number; n: number } | null;
  quality: number | null;
  state: CellState;
}

export interface UnlinkedPlanUnit {
  curriculumUnitId: string;
  title: string;
  lessons: number;
  lastHeldAt: string | null;
}

export interface WorkContextBucket {
  key: 'homework' | 'self_study' | 'classwork' | null;
  attempts: number;
  share: number;
  median: number | null;
}

export interface GroupProgressSummary {
  deliveredUnits: number;
  plannedUnits: number;
  lessonsHeld: number;
  lessonsPlanned: number;
  absorbedMedian: number | null;
  belowLine: number;
  belowLineRule: string;
  notJudgeable: number;
  lastActivityAt: string | null;
}

export interface GroupProgress {
  groupId: string;
  courseId: string | null;
  updatedAt: string;
  minWeightedSample: number;
  workContextSplitFrom: string;
  deliveryUnavailable: boolean;
  units: GroupProgressUnit[];
  unlinkedPlanUnits: UnlinkedPlanUnit[];
  summary: GroupProgressSummary;
  workContext: WorkContextBucket[];
  workContextUnattributed: number;
}

/**
 * Which of the four pictures this group is — decided once, here, rather than by each
 * section testing its own condition.
 *
 * They are genuinely different screens, not degrees of emptiness: a group with no course
 * needs a course, a group with no lessons needs a timetable, and a group that has been
 * taught but measured nothing needs homework. Telling them apart is the whole point of
 * the empty states in BEHAVIOR §A.
 */
export type ProgressPicture = 'full' | 'noCourse' | 'noLessons' | 'noAttempts';

export function pictureOf(progress: GroupProgress): ProgressPicture {
  if (progress.courseId === null) return 'noCourse';
  if (progress.summary.lessonsHeld === 0 && !progress.deliveryUnavailable) return 'noLessons';
  if (progress.summary.absorbedMedian === null) return 'noAttempts';
  return 'full';
}

/** One learner's row of the heatmap — DATA_MODEL §3.2. */
export interface HeatmapRow {
  studentId: string;
  displayName: string;
  lastActivityAt: string | null;
  /** Strictly one per unit, in the order of `units`. */
  cells: Array<{ state: CellState; value: number | null; weightedSample: number }>;
}

export interface GroupHeatmap {
  groupId: string;
  courseId: string | null;
  updatedAt: string;
  minWeightedSample: number;
  deliveryUnavailable: boolean;
  units: Array<{ unitId: string; no: number; title: string }>;
  rows: HeatmapRow[];
}

/** One pair of the learner's grid — DATA_MODEL §3.3, screen C. */
export interface StudentGridCell {
  skill: string;
  focus: string;
  state: CellState;
  /** Whole percent, or `null` whenever nothing was measured. */
  ewma: number | null;
  /** Days a right answer survives — the number behind "forgets fast". */
  meanStability: number | null;
  attempts: number;
  weightedSample: number;
}

export interface StudentGrid {
  studentId: string;
  courseId: string | null;
  minWeightedSample: number;
  /** Content could not be asked what the course trains; no cell claims `noContent`. */
  coverageUnavailable: boolean;
  /** No attempt at all: the screen prints its empty state instead of a grid. */
  nothingMeasured: boolean;
  /** Attempts in a channel the grid does not draw — said out loud, never dropped. */
  unclassifiedAttempts: number;
  cells: StudentGridCell[];
}

/** Where one learner stands against their group — `null` when there is no scale. */
export interface StudentPosition {
  own: number;
  groupMedian: number;
  percentile: number;
  lowerThan: number;
  band: 'below' | 'middle' | 'above';
  measured: number;
}

// ─── The recognition ↔ production gap (plan 63 §4.1) ─────────────────────────

export const GAP_MODALITIES = ['recognition', 'recall', 'production', 'unknown'] as const;
export type GapModality = (typeof GAP_MODALITIES)[number];

export interface ModalityReading {
  attempts: number;
  correct: number;
  /** `null` for a modality never attempted — the opposite statement from a zero. */
  successRate: number | null;
  meanStability: number | null;
  lastAt: string | null;
}

/**
 * What is lopsided about one fact.
 *
 * The first two are about what was never asked and carry no gap number; the two
 * `_failing` ones are about what was asked and went badly.
 */
export type GapVerdict =
  | 'recognition_only'
  | 'production_untried'
  | 'production_failing'
  | 'recall_failing';

export interface ModalityGapRow {
  atomType: string;
  atomId: string;
  /** `null` when content-service could not be asked; the finding still stands. */
  title: string | null;
  track: string | null;
  parentId: string | null;
  verdict: GapVerdict;
  /** How far the deeper modality falls below the shallow one, 0..1; `null` if never tried. */
  gap: number | null;
  byModality: Record<GapModality, ModalityReading>;
  /** Ratings of the atom's own card — the same answers seen from the card side. */
  cardReviews: number;
}

export interface ModalityGapSummary {
  addressedAtoms: number;
  judged: number;
  insufficient: number;
  recognitionOnly: number;
  productionUntried: number;
  productionFailing: number;
  recallFailing: number;
  even: number;
  /**
   * Atoms of a kind known only one way by nature (a phonological contrast is heard, never
   * recalled), so never judged. Optional: an analytics service older than plan 72 omits it.
   */
  notCompared?: number;
  observations: number;
  contextObservations: number;
  cardReviews: number;
  byModality: Record<GapModality, number>;
}

export interface ModalityGap {
  studentId: string;
  courseId: string | null;
  /** The bar a verdict was made under, reported so the screen can name it. */
  minAttempts: number;
  thresholds: { strong: number; failing: number };
  /** False when the atom names could not be asked for — labels missing, findings intact. */
  namesAvailable: boolean;
  summary: ModalityGapSummary;
  gaps: ModalityGapRow[];
}

export interface StudentWorkContext {
  studentId: string;
  courseId: string | null;
  buckets: WorkContextBucket[];
  /** Attempts naming no course at all, and so in no bucket. */
  unattributed: number;
}

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

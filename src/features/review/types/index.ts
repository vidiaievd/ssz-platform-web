/**
 * The teacher's side of the review system, as the screens read it.
 *
 * These are BFF shapes, not upstream ones. exercise-engine answers in ids and instants and
 * knows nothing about a promised response time; organization-service knows who may review
 * and nothing about what is waiting. What a screen needs is one object per row carrying a
 * name, an age and a promise — that composition is the BFF's whole job here, and this file
 * is its output contract (`API_CONTRACT.md` §1–2).
 */

/** The five templates whose check may refuse to close, and so reach a person. */
export const REVIEWABLE_EXERCISE_TYPES = [
  'short_answer',
  'writing_task',
  'translate_to_target',
  'translate_from_target',
  'error_correction',
] as const;

export type ReviewableExerciseType = (typeof REVIEWABLE_EXERCISE_TYPES)[number];

/** Marking happens in passes: through one exercise, or through one learner's work. */
export type ReviewGroupBy = 'exercise' | 'student';

export interface ReviewQueueFilters {
  groupBy: ReviewGroupBy;
  /** A group of the teacher's own scope; anything else narrows the queue to nothing. */
  group: string | null;
  course: string | null;
  type: ReviewableExerciseType | null;
  overdueOnly: boolean;
}

/** Who a submission came from, joined in from the profile directory. */
export interface ReviewLearner {
  id: string;
  /** Null when the directory could not answer — the row still opens, under its id. */
  name: string | null;
  groupName: string | null;
}

/** A colleague has this one open. Advisory: the row stays clickable (criterion 7). */
export interface ReviewQueueLock {
  teacherId: string;
  teacherName: string | null;
  expiresAt: string;
}

export interface ReviewQueueItem {
  /** The attempt id — what every later call about this submission is keyed by. */
  id: string;
  student: ReviewLearner;
  exerciseId: string | null;
  /** From the snapshot taken when the learner started, so a deleted exercise still reads. */
  exerciseTitle: string | null;
  submittedAt: string;
  /** Hours waited, computed at response time — the client does not re-derive it. */
  ageHours: number;
  overdue: boolean;
  attemptNo: number;
  /** The machine closed every item. A hint for the batch button; the verdict re-checks. */
  autoClean: boolean;
  lock: ReviewQueueLock | null;
}

export interface ReviewQueueGroup {
  key: string;
  kind: ReviewGroupBy;
  /** The exercise, or the learner — whichever this pass is grouped by. */
  title: string | null;
  path: { course: string | null; lesson: string | null; type: string | null } | null;
  /**
   * The promise these ages are coloured against, per group rather than per request: a
   * teacher's queue crosses courses, and courses set their own (`API_CONTRACT.md` §1).
   * Null when neither the course nor the school has made one.
   */
  slaHours: number | null;
  count: number;
  /** Every age in the group, for the histogram. An aggregate cannot reproduce it. */
  ages: number[];
  overdue: number;
  autoCleanIds: string[];
  items: ReviewQueueItem[];
}

export interface ReviewQueueSummary {
  /** The whole scope, not this page. */
  pending: number;
  /**
   * How many of those are past their promise — counted over what has been loaded, since
   * lateness needs a promise and a promise needs the course each submission belongs to.
   * `overduePartial` says when more may be waiting behind the cursor.
   */
  overdue: number;
  overduePartial: boolean;
  /** Age of the oldest submission in the whole scope. Null when nothing is waiting. */
  oldestHours: number | null;
}

export interface ReviewQueueResponse {
  summary: ReviewQueueSummary;
  groups: ReviewQueueGroup[];
  nextCursor: string | null;
}

/** The sidebar badge: a number, and whether a dot belongs beside it (criterion 9). */
export interface ReviewQueueCount {
  pending: number;
  hasOverdue: boolean;
}

/**
 * The teacher's side of the review system, as the screens read it.
 *
 * These are BFF shapes, not upstream ones. exercise-engine answers in ids and instants and
 * knows nothing about a promised response time; organization-service knows who may review
 * and nothing about what is waiting. What a screen needs is one object per row carrying a
 * name, an age and a promise — that composition is the BFF's whole job here, and this file
 * is its output contract (`API_CONTRACT.md` §1–2).
 */

// Deep import rather than the feature barrel: `content-authoring/index.ts` re-exports its
// components, so a route handler importing a type from it would pull client code into a
// server bundle — and both features happen to name a type `ReviewQueueResponse`.
import type {
  ReviewDetails,
  ShortAnswerDetails,
  WritingTaskDetails,
} from '@/features/content-authoring/types/review';
import type { RubricSnapshot } from '@/lib/shared-kernel/writing-task';

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

/**
 * What the filter row may offer — the teacher's whole scope, not what survived the
 * filters. Options derived from the rows on screen would leave no way back.
 */
export interface ReviewQueueFacets {
  groups: { id: string; name: string }[];
  courses: { id: string; name: string }[];
}

export interface ReviewQueueResponse {
  summary: ReviewQueueSummary;
  facets: ReviewQueueFacets;
  groups: ReviewQueueGroup[];
  nextCursor: string | null;
}

/** The sidebar badge: a number, and whether a dot belongs beside it (criterion 9). */
export interface ReviewQueueCount {
  pending: number;
  hasOverdue: boolean;
  /**
   * Whether this person has anything to review at all — any group, in any window.
   *
   * Separate from `pending: 0`, and the sidebar turns on the difference: a teacher who has
   * marked everything should see the item with no number, and a school's accountant should
   * not see it at all. The count is the only thing the shell asks, so it has to carry the
   * answer; deriving it from the role instead would be wrong in both directions, because
   * what makes a queue is being assigned to a group, not holding a job title.
   */
  hasScope: boolean;
}

/**
 * A verdict that has already been delivered — on the try before this one, or on this one
 * by a colleague who got here first.
 */
export interface ReviewVerdictRecord {
  attemptId: string;
  outcome: 'approved' | 'returned';
  at: string;
  reviewerId: string;
  /** Null when the directory could not answer; the banner then names the outcome only. */
  reviewerName: string | null;
  comment: string | null;
}

/** The exercise a submission belongs to, as the reviewer's screen needs to read it. */
export interface ReviewSubmissionExercise {
  id: string;
  /** The snapshot's title — it outlives the exercise itself (criterion 21). */
  title: string | null;
  /** The template code: `short_answer`, `writing_task`, … */
  type: string;
  path: { course: string | null; lesson: string | null };
  /** False when the author deleted or moved it after the submission was made. */
  available: boolean;
  /** What the work is written in — the language the æøå pad is there for. */
  contentLang: string;
}

/**
 * One submission, with everything the reviewer's screen is drawn from.
 *
 * Composed here and nowhere else: the engine holds the answer and recomputes the
 * breakdown, organization-service holds the promise and the group, the directory holds
 * the names. A screen that fetched the three itself would authorise none of them.
 */
export interface ReviewSubmission {
  id: string;
  /** The engine's own status. `pending` is the only one that is still open. */
  status: string;
  student: ReviewLearner;
  exercise: ReviewSubmissionExercise;
  submittedAt: string | null;
  /** Hours waited, computed at response time — one formula, one source (45.1). */
  ageHours: number;
  slaHours: number | null;
  overdue: boolean;
  attemptNo: number;
  /** The verdict that sent the learner back here. Null on a first try. */
  previous: ReviewVerdictRecord | null;
  /** Already decided — the screen is read-only and says who got here first. */
  decision: ReviewVerdictRecord | null;
  lock: ReviewQueueLock | null;
  /**
   * The machine's reading of the work, recomputed on every read. `null` is a valid
   * answer, not an error: the screen says so and the verdict stays open (criterion 20).
   *
   * Typed by the shape `submission-card` already speaks — 45.6 moves that card here, and
   * inventing a second vocabulary for the same breakdown would mean translating between
   * them forever.
   *
   * A free text is the one template with no items in it, so it brings its own shape:
   * words, paragraphs and point coverage instead of a per-sentence breakdown. Narrow on
   * `exercise.type` before reading either, and read the writing-task half through
   * `readWritingTaskDetails` — the breakdown is recomputed against the exercise as it
   * stands today, which for an old submission is not the shape this union promises.
   *
   * `short_answer` carries a third member, and needs the same care for a second reason:
   * two templates answer to that code, and the older one — still live in 144 exercises —
   * reports no items at all. `readShortAnswerDetails` is what tells them apart, and it
   * refuses whole rather than filling in zeros (plan 51 §6.7).
   */
  details: ReviewDetails | ShortAnswerDetails | WritingTaskDetails | null;
  /** `writing_task` only: the essay itself. */
  text: string | null;
  /**
   * The rubric this submission is measured against, frozen when it reached the queue —
   * not the exercise's rubric as it reads today. An author who reworded a criterion or
   * moved the threshold afterwards must not change what an already-written text is
   * judged by, and it stays readable after the exercise itself is deleted (plan 50
   * §3.2). Null for every submission graded out of items, which is the screen's cue to
   * keep the plain approve/return buttons.
   */
  rubric: RubricSnapshot | null;
  /**
   * The marks behind a verdict already delivered, keyed by criterion id — what the
   * read-only screen shows. Null while the submission is still waiting: marks start
   * unset and are never pre-filled.
   */
  rubricMarks: Record<string, number> | null;
  submittedAnswer: unknown;
  /** Whether this caller may still decide it — an expired substitution may only read. */
  canDecide: boolean;
}

/** What a lock call answers: who holds the submission now, and until when. */
export interface ReviewLockState {
  lock: ReviewQueueLock | null;
  /** True when the holder is the caller — the screen's own marker, freshly extended. */
  mine: boolean;
}

/** Why one submission of a batch was left alone (plan 44 §44.10, plus the BFF's own). */
export type ReviewBatchSkipReason =
  | 'not_found'
  | 'already_reviewed'
  | 'not_pending'
  | 'not_clean'
  | 'unavailable';

/**
 * What a batch approval did. Partial success is the normal outcome, not an error: the
 * screen reports a count and says how many names it had to leave alone, and why.
 */
export interface ReviewBatchResult {
  approved: number;
  skipped: { id: string; reason: ReviewBatchSkipReason }[];
}

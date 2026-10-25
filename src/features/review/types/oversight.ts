/**
 * The administrator's side of the review system (`API_CONTRACT.md` §6).
 *
 * One answer per screen, because the screen is opened once a week and must not turn into
 * an investigation. Everything here is composed in the BFF: exercise-engine reports times
 * and ids, organization-service says who reviews which group, content-service and the
 * school say what was promised, and the directory supplies the names. None of the four
 * could answer this question alone, and asking them from the browser would authorise none
 * of them.
 *
 * The vocabulary is deliberately about load, never about fault: `overdue` counts
 * submissions past a promise, and the screens say "longer than promised" (criterion 29).
 */

/** How far back verdicts are counted for the medians. The screen's only knob. */
export const OVERSIGHT_PERIODS = [7, 30, 90] as const;

export type OversightPeriod = (typeof OVERSIGHT_PERIODS)[number];

/** The school's whole queue, in the four numbers the summary is made of. */
export interface OversightSummary {
  pending: number;
  /** Past the promise of the course each submission belongs to. */
  overdue: number;
  /** Age of the oldest waiting submission, in hours. Null when nothing waits. */
  oldestHours: number | null;
  /**
   * The middle of the answering times over the period — a median, not a mean: one work
   * left for a fortnight over the holidays would drag an average past anything the school
   * would recognise as its own pace.
   */
  medianHours: number | null;
}

/**
 * Work a model's provisional verdict closed by itself when the term ran out (plan 80, R4).
 *
 * Counted on the days the terms ran out, over the screen's period. `revised` is work a
 * teacher still gave a verdict on afterwards; `overturned` is the part of it where that
 * verdict differed from the model's.
 */
export interface OversightTermTally {
  accepted: number;
  revised: number;
  overturned: number;
}

/** The school's side of the journal: each work once, whoever answered for it. */
export interface OversightTerms extends OversightTermTally {
  /**
   * Work no teacher answered for on the day its term ran out — a group without staff that
   * day. Null when organization-service could not say who did.
   */
  unattributed: number | null;
  /** False when the teachers could not be named, so the rows carry no figures of their own. */
  attributed: boolean;
}

/** One teacher's load. The shape of the queue is the row's point, not its size. */
export interface OversightTeacher {
  id: string;
  name: string | null;
  /** The groups they hold right now, by name — what the row is read by. */
  groups: string[];
  /** The same groups by id, in the same order — where a helper for this teacher can go. */
  groupIds: string[];
  pending: number;
  overdue: number;
  /** Every waiting age, for the histogram. */
  ages: number[];
  medianHours: number | null;
  /**
   * Whether any of this teacher's waiting work is also waiting on a colleague — a group
   * with two reviewers puts each submission in both queues. The school's summary counts
   * it once; these rows count it for each, and the row says so.
   */
  shared: boolean;
  /**
   * What a model's verdict closed by itself in work this teacher answered for. Null when
   * nothing was, or when the school's journal could not be read or attributed.
   */
  terms: OversightTermTally | null;
}

export interface OversightGroup {
  id: string;
  name: string | null;
  pending: number;
  overdue: number;
  ages: number[];
}

export interface OversightCourse {
  id: string;
  name: string | null;
  /** The promise submissions of this course are coloured against. */
  slaHours: number | null;
  /** True when the course set its own rather than inheriting the school's. */
  overridden: boolean;
  pending: number;
  overdue: number;
  ages: number[];
}

/** One submission that has been waiting longer than promised, named. */
export interface OversightStuck {
  /** The attempt id — what "review it yourself" opens and "assign" is about. */
  id: string;
  studentId: string;
  studentName: string | null;
  exerciseTitle: string | null;
  groupId: string | null;
  groupName: string | null;
  /** Whoever the group rule makes responsible. Null when nobody is. */
  teacherName: string | null;
  submittedAt: string;
  hours: number;
  slaHours: number | null;
  /**
   * The learner was in no group when they started, so `reviewers(sub)` yields nobody and
   * this work is waiting on no one at all. Said in words on the row (criterion 31), never
   * left to be inferred from an empty column.
   */
  unassigned: boolean;
}

export interface ReviewOversightResponse {
  /** The school's id — what the assignment dialog posts to. */
  schoolId: string;
  /**
   * The school's data horizon: the first submission that carries a school at all. Printed
   * under the heading, because statistics from a partial history presented as a whole one
   * are worse than no statistics (criterion 27).
   */
  since: string | null;
  periodDays: OversightPeriod;
  /** The school's own promise, for the legends under the histograms. */
  schoolSlaHours: number | null;
  /** The engine stopped counting at its ceiling; the picture is the same, the totals are not. */
  truncated: boolean;
  summary: OversightSummary;
  /** Every waiting age in the school, counted once each. */
  ages: number[];
  teachers: OversightTeacher[];
  groups: OversightGroup[];
  courses: OversightCourse[];
  stuck: OversightStuck[];
  /**
   * The auto-acceptance journal over the period. Null when analytics could not be asked —
   * never a row of zeros standing in for "unknown".
   */
  terms: OversightTerms | null;
}

/** What a reminder did. One message with a number in it, not one per submission. */
export interface ReviewRemindResult {
  sent: boolean;
  /** How many submissions the message mentioned. */
  pending: number;
  /** Set when the teacher was reminded within the last day — the screen says when. */
  retryAfterHours?: number;
}

/** One line of the decision journal (`API_CONTRACT.md` §6, criterion 32). */
export interface ReviewDecisionEntry {
  id: string;
  reviewedAt: string;
  reviewerId: string;
  reviewerName: string | null;
  studentId: string;
  studentName: string | null;
  exerciseTitle: string | null;
  courseTitle: string | null;
  verdict: 'approved' | 'returned';
  /** Hours between handing in and answering — null when the submission time is lost. */
  hours: number | null;
}

export interface ReviewDecisionsResponse {
  items: ReviewDecisionEntry[];
  nextCursor: string | null;
}

/** What a school promises, and who hears about it when the promise passes (§7). */
export interface SchoolReviewSettings {
  respondWithinHours: number;
  escalateAfterHours: number;
  escalateTo: 'school_admins' | 'owner' | 'primary_teacher';
}

/** Who answers a learner's work first (plan 80, R1). */
export type ReviewAiMode = 'teacher_only' | 'ai_then_teacher' | 'ai_with_sampling';

/**
 * How a school uses a model to answer work, beside the promise of a person's answer.
 *
 * Kept apart from `SchoolReviewSettings` the way organization-service keeps it: the promise
 * is every school's, the modes with a model come with the plan (`school.review_ai_policy`).
 * The hours and the share are stored whatever the mode, so turning the model off and on
 * again finds them where they were left.
 */
export interface SchoolReviewAiPolicy {
  mode: ReviewAiMode;
  /** After this, a model's provisional verdict counts by itself. Never before the escalation. */
  autoAcceptAfterHours: number;
  /** Share of `ai_with_sampling` work sent to the teacher at random, 0–100. */
  samplePercent: number;
}

/**
 * A course's part of the school's policy (plan 80, step 2): its own auto-accept term and the
 * templates whose work always goes to a teacher when the school samples.
 *
 * Read with what it inherits and what it is held to, all resolved by content-service: the
 * applied term is the course's own raised to the school's escalation (Q2-A), or the school's.
 */
export interface CourseReviewAiPolicy {
  /** What applies now. Null when there is no school behind the course to inherit from. */
  autoAcceptAfterHours: number | null;
  inheritedAutoAcceptAfterHours: number | null;
  overridden: boolean;
  /** The school's escalation; a course term below it is raised to it on read. */
  escalationFloorHours: number | null;
  teacherReviewTemplates: string[];
  schoolMode: ReviewAiMode | null;
  samplePercent: number | null;
  ownerSchoolId: string | null;
}

/** What a course sends: `null` hands the term back to the school. */
export interface CourseReviewAiPolicyInput {
  autoAcceptAfterHours: number | null;
  teacherReviewTemplates: string[];
}

/**
 * A course's promise, always alongside the one it would inherit.
 *
 * Both numbers travel together so the field in the settings drawer is never empty: an
 * override that is switched off shows the school's figure, greyed, rather than a blank
 * box that reads as "nothing is promised" (criterion 35).
 */
export interface CourseReviewSettings {
  respondWithinHours: number | null;
  inheritedHours: number | null;
  overridden: boolean;
}

/** Whose a starting figure is: the school's own, or the factory value it has not changed. */
export type ReviewEffortSource = 'school' | 'default';

/**
 * Minutes per submission a school expects, by template (plan 81, Q5) — the starting figure
 * a review forecast uses until the school's own measurements take over.
 */
export interface SchoolReviewEffortMinutes {
  templates: { templateCode: string; minutes: number; source: ReviewEffortSource }[];
  /** For a template on no list. */
  other: { minutes: number; source: ReviewEffortSource };
}

/** What the school's own verdicts say about one template (exercise-engine `review/effort`). */
export interface ReviewEffortMeasurement {
  templateCode: string;
  /** Timed verdicts in the window, also when too few to trust. */
  sampleSize: number;
  /** The median, once `sampleSize` reaches `minSample`; null until then. */
  medianMinutes: number | null;
}

/** The settings screen's read: the school's figures, and beside them what it has measured. */
export interface SchoolReviewEffort extends SchoolReviewEffortMinutes {
  /** Null when the measurements could not be read; the figures are still shown. */
  measured: {
    historyDays: number;
    minSample: number;
    templates: ReviewEffortMeasurement[];
  } | null;
}

/** The form's write, whole: a template left out goes back to the factory figure. */
export interface SchoolReviewEffortInput {
  templates: Record<string, number>;
  other: number | null;
}

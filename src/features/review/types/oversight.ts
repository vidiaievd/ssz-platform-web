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

/** One teacher's load. The shape of the queue is the row's point, not its size. */
export interface OversightTeacher {
  id: string;
  name: string | null;
  /** The groups they hold right now, by name — what the row is read by. */
  groups: string[];
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

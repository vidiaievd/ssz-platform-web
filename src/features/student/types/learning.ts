import type { LangCode, CEFR, Weekday, HHMM, ISODate, AgeBand, GroupMode } from '@/features/groups/types';
import type { MembershipStatus } from '@/features/enrollment/types';
import type { DifficultyLevel } from '@/features/content/types';

/** Stages of a membership that hasn't reached `active` yet — nothing to show beyond "where it stands". */
export type PendingStage = 'onboarding' | 'placement-review';

export type LessonProgressStatus = 'not_started' | 'in_progress' | 'completed' | 'needs_review';

/** A student's own progress on a single lesson — sourced from learning-service UserProgress. */
export interface LessonProgressRecord {
  lessonId: string;
  status: LessonProgressStatus;
  score: number | null;
  completedAt: string | null;
}

export type AssignmentContentType = 'CONTAINER' | 'LESSON' | 'VOCABULARY_LIST' | 'GRAMMAR_RULE' | 'EXERCISE';

export type AssignmentStatusLower = 'active' | 'completed' | 'cancelled' | 'overdue';

/**
 * A piece of content a teacher/tutor explicitly assigned to the student, with a due
 * date — distinct from the group's curriculum (browsable, no due date). Sourced from
 * learning-service Assignment, hydrated with a display title from content-service.
 * `href` is null when no student-facing page exists yet for this content type.
 */
export interface AssignedMaterial {
  assignmentId: string;
  contentType: AssignmentContentType;
  contentId: string;
  title: string;
  status: AssignmentStatusLower;
  dueAt: string;
  notes: string | null;
  href: string | null;
}

export interface ScheduleSlot {
  day: Weekday;
  start: HHMM;
  end: HHMM;
  room: string;
}

export interface NextLesson {
  day: Weekday;
  start: HHMM;
  end: HHMM;
  /** ISO date of the next occurrence. */
  date: ISODate;
}

export interface SchoolTeacherSummary {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: 'primary' | 'co-primary' | 'substitute';
}

/** One material attached to a group — the main course (`isMain`) or an additional one. */
export interface SchoolMaterial {
  id: string;
  courseId: string;
  courseName: string | null;
  isMain: boolean;
}

/**
 * A course the student studies on their own — no school, no group, no
 * schedule. Access is the student's own content-service enrollment, full
 * stop; nothing here is gated by anyone else's decision.
 */
export interface SelfStudyCourse {
  kind: 'self-study';
  containerId: string;
  title: string;
  targetLanguage: LangCode;
  level: DifficultyLevel;
  progressPercent: number;
  coverImageUrl?: string;
}

/**
 * A course taught by a school. Unlike self-study, access is derived
 * entirely from group membership: a student only sees a `SchoolCourse` once
 * their membership is `active` and they've been placed in a group — that
 * group's main course (and any additional materials) is what becomes
 * visible. There is no independent "enroll in this course" action here.
 */
export interface SchoolCourse {
  kind: 'school';
  containerId: string;
  title: string;
  targetLanguage: LangCode;
  level: CEFR;
  schoolId: string;
  schoolSlug: string;
  schoolName: string;
  groupId: string;
  groupName: string;
  teachers: SchoolTeacherSummary[];
  schedule: ScheduleSlot[];
  nextLesson: NextLesson | null;
}

export type LearningCourse = SelfStudyCourse | SchoolCourse;

/**
 * One row of the "My schools" band — a membership joined with its derived
 * group/schedule/teacher/material data once `active`. Non-active rows only
 * carry `pendingStage`: there is nothing else to show until a group exists.
 */
export interface StudentSchool {
  membershipId: string;
  schoolId: string;
  schoolSlug: string;
  schoolName: string;
  status: MembershipStatus;
  /** Set only while status is 'onboarding' or 'placement-review'. */
  pendingStage?: PendingStage;
  groupId: string | null;
  groupName: string | null;
  /** Null once the student has dismissed the one-time group-assigned banner (or never had one). */
  groupAssignedSeenAt: string | null;
  level: CEFR | null;
  mode: GroupMode | null;
  ageBand: AgeBand | null;
  teachers: SchoolTeacherSummary[];
  schedule: ScheduleSlot[];
  nextLesson: NextLesson | null;
  mainCourse: SchoolMaterial | null;
  materials: SchoolMaterial[];
  classmateCount: number | null;
}

/** Aggregate backing the student-learning home: school memberships + independent self-study. */
export interface LearningHome {
  schools: StudentSchool[];
  selfStudy: SelfStudyCourse[];
}

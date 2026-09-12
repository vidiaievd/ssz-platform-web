import type { Alert } from '@/features/dashboard/types';

export type LangCode = string; // ISO 639-1
export type CEFR = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type HHMM = string; // "HH:MM"
export type ISODate = string; // "YYYY-MM-DD"
export type GroupStatus = 'draft' | 'active' | 'archived';
export type GroupMode = 'online' | 'in-person';
export type TeacherRole = 'primary' | 'co-primary' | 'substitute';
export type AgeBand = 'kids' | 'teens' | 'adults';

export interface Slot { id?: string; day: Weekday; start: HHMM; end: HHMM; room: string; }
export interface Substitution { teacherId: string; from: ISODate; to: ISODate; reason: string; }

export interface GroupTeacher {
  userId: string; name: string; avatarUrl?: string | null;
  role: TeacherRole; from?: ISODate; to?: ISODate; reason?: string;
  hours?: number; max?: number; langs?: LangCode[];
}

/** Additional material attached to a group — distinct from the group's
 *  single, non-removable main material (Group.courseId/courseName). */
export interface GroupMaterial {
  id: string;
  courseId: string;
  courseName: string | null;
}

export interface Group {
  id: string; name: string;
  courseId: string | null; courseName?: string | null;
  materials: GroupMaterial[];
  lang: LangCode; level: CEFR;
  status: GroupStatus; mode: GroupMode;
  capacity: { min: number; max: number };
  studentCount: number;
  startDate: ISODate | null; endDate: ISODate | null;
  teachers: GroupTeacher[];
  slots: Slot[];
  ageBand: AgeBand | null;
}

/** Read-only course view backing CourseChip/CoursePanel — derived from Group, no new endpoint. */
export interface CourseView {
  courseId: string | null;
  courseName: string | null;
  lang: LangCode;
  level: CEFR;
  /** Curriculum unit count; null when unavailable or not yet looked up. */
  unitCount: number | null;
}

export interface GroupHealthRowVM {
  id: string; name: string; lang: LangCode; level: CEFR;
  courseName: string | null;
  status: GroupStatus; mode: GroupMode;
  primaryTeacher: { name: string; avatarUrl?: string | null } | null;
  coPrimaryTeacher: { name: string } | null;
  scheduleSummary: string;
  studentCount: number; capacity: { min: number; max: number };
  alerts: Alert[];
}

export interface RosterStudent {
  userId: string; name: string; email: string; avatarUrl?: string | null;
  level: CEFR; status: 'active' | 'at-risk' | 'new' | 'finished' | 'clash' | 'unassigned';
  /** 0..100. The students screen keeps a 0..1 ratio; the roster draws a percentage. */
  progress: number;
  hasClash: boolean;
}

export type LessonStatus = 'scheduled' | 'moved' | 'cancelled' | 'held';

export interface Lesson {
  id: string; groupId: string; date: ISODate; start: HHMM; end: HHMM;
  teacherId: string; teacherName: string; room: string; isSubstitute: boolean;
  status: LessonStatus;
  /** Curriculum unit this lesson teaches — set at generation, repointable by hand. */
  curriculumUnitId: string | null;
}

/** An exam is a kind of session, not a separate thing — one log covers both. */
export type SessionType = 'lesson' | 'exam' | 'make_up' | 'review';

/** One student's mark on one exam. `null` means ungraded — not zero. */
export interface SessionScore {
  studentId: string;
  score: number | null;
}

/**
 * One meeting of a group: when it is, who teaches it, what it covers, and — once
 * it has happened — what came of it. The unit the schedule-and-log tab reads.
 */
export interface Session {
  id: string;
  groupId: string;
  schoolId: string;
  slotId: string | null;
  date: ISODate;
  start: HHMM;
  end: HHMM;
  /** Null when nobody is assigned yet; such a session counts towards no teacher. */
  teacherId: string | null;
  room: string;
  status: LessonStatus;
  type: SessionType;
  /** Unit of the group's teaching plan — what group progress is counted against. */
  curriculumUnitId: string | null;
  /** The course unit and item this session covers. Both null while no topic is set. */
  contentUnitId: string | null;
  contentLessonId: string | null;
  /** How many turned up. Only meaningful once held, and never for an exam. */
  attendance: number | null;
  /** Why it was cancelled. */
  note: string | null;
  /** Added by hand, outside the weekly pattern. */
  extra: boolean;
  planIndex: number | null;
  /** Pass mark for this exam alone; null follows the school's. */
  passMark: number | null;
  scores: SessionScore[];
}

export interface TimetableTeacher {
  userId: string; name: string; avatarUrl?: string | null;
  hours: number; max: number; pct: number; overloaded: boolean;
  groups: number; conflicts: number;
  lessons: Array<{
    day: Weekday; start: HHMM; end: HHMM;
    groupId: string; groupName: string; lang: LangCode; isSubstitute: boolean;
  }>;
}

/** Raw projection from scheduling-service — one teacher's assigned future lessons, undecorated. */
export interface RawTimetableEntry {
  day: Weekday; start: HHMM; end: HHMM; groupId: string; room: string | null;
}

/** Raw school-wide projection — same shape, every teacher in one query. */
export interface RawSchoolTimetableEntry extends RawTimetableEntry {
  teacherId: string;
}

export interface OpsWarning {
  type: 'conflict' | 'overload' | 'over' | 'under' | 'clash';
  with?: string; day?: Weekday; time?: string;
}

/** Derived availability for a teacher against a proposed weekly slot set (no positive-availability calendar). */
export type TeacherAvailabilityStatus = 'free' | 'conflict' | 'absent';
export interface TeacherAvailability {
  teacherId: string;
  status: TeacherAvailabilityStatus;
  /** Group whose lesson overlaps a proposed slot, when status is 'conflict'. */
  conflictGroupId?: string | null;
  /** Absence record covering today, when status is 'absent'. */
  absenceId?: string | null;
}

export type MutationResult =
  | { ok: true; warnings?: OpsWarning[] }
  | { ok: false; conflicts?: OpsWarning[]; warnings?: OpsWarning[]; blocked?: 'language' | 'no-primary' };
/** One teachable item of a course unit, named by the identity a session stores. */
export interface OutlineItem {
  /** Stable id of the item itself — what `Session.contentLessonId` points at. */
  id: string;
  itemType: string;
  kind: string | null;
  title: string;
}

export interface OutlineUnit {
  /** Stable id of the unit — what `Session.contentUnitId` points at. */
  id: string;
  title: string;
  /** Position among the course's units, from 1 — the `Unit N` the tab prints. */
  order: number;
  items: OutlineItem[];
}

export interface CourseOutlineView {
  units: OutlineUnit[];
}


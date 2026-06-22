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
  progress: number;
  hasClash: boolean;
}

export interface Lesson {
  id: string; groupId: string; date: ISODate; start: HHMM; end: HHMM;
  teacherId: string; teacherName: string; room: string; isSubstitute: boolean;
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

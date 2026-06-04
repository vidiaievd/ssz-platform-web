import type { Alert } from '@/features/dashboard/types';

export type LangCode = string; // ISO 639-1
export type CEFR = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type HHMM = string; // "HH:MM"
export type ISODate = string; // "YYYY-MM-DD"
export type GroupStatus = 'draft' | 'active' | 'archived';
export type GroupMode = 'online' | 'in-person';
export type TeacherRole = 'primary' | 'co-primary' | 'substitute';

export interface Slot { id?: string; day: Weekday; start: HHMM; end: HHMM; room: string; }
export interface Substitution { teacherId: string; from: ISODate; to: ISODate; reason: string; }

export interface GroupTeacher {
  userId: string; name: string; avatarUrl?: string | null;
  role: TeacherRole; from?: ISODate; to?: ISODate; reason?: string;
  hours?: number; max?: number; langs?: LangCode[];
}

export interface Group {
  id: string; name: string;
  courseId: string | null; courseName?: string | null;
  lang: LangCode; level: CEFR;
  status: GroupStatus; mode: GroupMode;
  capacity: { min: number; max: number };
  studentCount: number;
  startDate: ISODate | null; endDate: ISODate | null;
  teachers: GroupTeacher[];
  slots: Slot[];
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

export interface OpsWarning {
  type: 'conflict' | 'overload' | 'over' | 'under' | 'clash';
  with?: string; day?: Weekday; time?: string;
}

export type MutationResult =
  | { ok: true; warnings?: OpsWarning[] }
  | { ok: false; conflicts?: OpsWarning[]; warnings?: OpsWarning[]; blocked?: 'language' | 'no-primary' };

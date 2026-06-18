import type { CEFR, LangCode, ISODate } from '@/features/groups/types';

export type { CEFR, LangCode, ISODate };

export type StudentStatus = 'active' | 'at-risk' | 'new' | 'finished' | 'clash' | 'unassigned';

export interface StudentGroupRef {
  id: string;
  name: string;
  lang: LangCode;
  level: CEFR;
  scheduleSummary?: string;
  teachers?: Array<{
    userId: string;
    name: string;
    role: 'primary' | 'co-primary' | 'substitute';
    avatarUrl?: string | null;
  }>;
}

export interface StudentListItem {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  lang: LangCode;
  level: CEFR;
  /** Derived on the server; never stored as a manual override. */
  status: StudentStatus;
  groups: StudentGroupRef[];
  /** 0..1 */
  progress: number;
  lastSeen: ISODate | null;
  enrolledAt: ISODate;
}

export interface StudentDetail extends StudentListItem {
  clashes: Array<{
    groupA: string;
    groupB: string;
    day: string;
    time: string;
  }>;
  clashesError?: string;
}

export interface TeacherRef {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  role: 'primary' | 'co-primary' | 'substitute';
}

export type SegmentKey =
  | 'all'
  | 'at-risk'
  | 'no-group'
  | 'clash'
  | 'new'
  | 'multi-group'
  | 'finished';

export interface SegmentPredicate {
  status?: StudentStatus | StudentStatus[];
  inactiveDays?: number;
  minGroups?: number;
  maxGroups?: number;
}

export interface Segment {
  id: string;
  name: string;
  key: SegmentKey;
  predicate: SegmentPredicate;
  count?: number;
}

export type EnrollBranch = 'register' | 'attach-direct' | 'onboard-existing';

export interface EmailResolveResult {
  branch: EnrollBranch;
  userId?: string;
  displayName?: string;
}

export interface StudentsListResult {
  items: StudentListItem[];
  total: number;
  nextCursor?: string | null;
}

// ── Detail page types (spec §2) ───────────────────────────────────────────────

export type MembershipRole = 'student' | 'trial' | 'observer';
export type MembershipStatus = 'active' | 'past';
export type GroupStatus = 'draft' | 'active' | 'archived';

export interface Slot {
  day: string;
  time: string;
  durationMin?: number;
}

export interface MembershipDetail {
  id: string;
  groupId: string;
  groupName: string;
  lang: LangCode;
  level: CEFR;
  role: MembershipRole;
  status: MembershipStatus;
  addedAt: ISODate;
  exitedAt?: ISODate;
  teachers: TeacherRef[];
  schedule: Slot[];
  groupStatus: GroupStatus;
}

export interface LevelEntry {
  level: CEFR;
  startedAt: ISODate;
  endedAt?: ISODate;
  groupId?: string;
  groupName?: string;
  assessedBy?: TeacherRef;
}

/** Enriched student for the detail page (school-scoped). */
export interface StudentInSchool {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string | null;
  status: StudentStatus;
  addedToSchoolAt: ISODate;
  primaryLanguage: LangCode;
  currentLevel: CEFR;
  /** 0–100 */
  progress: number;
  lastActiveAt: ISODate | null;
  memberships: MembershipDetail[];
  levelHistory: LevelEntry[];
  teacherIds: string[];
  clashes: Array<{ groupA: string; groupAId: string; groupB: string; groupBId: string; day: string; time: string }>;
  clashesError?: string;
}

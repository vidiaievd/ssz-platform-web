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

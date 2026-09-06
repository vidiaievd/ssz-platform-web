import type { LangCode, CEFR, Weekday, HHMM, ISODate } from '@/features/groups/types';

export type { LangCode, CEFR, Weekday, HHMM, ISODate };

export type EmploymentType = 'full' | 'part' | 'contract';
export type TeacherStatus = 'active' | 'invited' | 'inactive';
export type HealthState = 'ok' | 'warn' | 'danger';

export interface Teacher {
  teacherId: string;
  name: string;
  avatarUrl?: string | null;
  languages: LangCode[];
  maxWeeklyContactHours: number;
  employmentType: EmploymentType;
  status: TeacherStatus;
  availabilityBlocks: AvailabilityBlock[];
  // DERIVED (from operations / projection):
  currentContactHours: number;
  currentPrepHours: number;
  effectiveLoadHours: number;
  utilizationPct: number;
  healthState: HealthState;
}

export type AvailabilityType = 'available' | 'preferred' | 'unavailable';

export interface AvailabilityBlock {
  blockId: string;
  teacherId: string;
  dayOfWeek: Weekday;
  startTime: HHMM;
  endTime: HHMM;
  type: AvailabilityType;
  recurring: boolean;
  validFrom: ISODate | null;
  validTo: ISODate | null;
}

export type AbsenceKind = 'sick' | 'leave' | 'vacancy';
export type AbsenceScope = 'today' | 'window' | 'permanent';

export interface Absence {
  absenceId: string;
  teacherId: string;
  kind: AbsenceKind;
  scope: AbsenceScope;
  from: ISODate;
  to: ISODate | null;
  reason: string;
  affectedLessonCount: number;
  coveredCount: number;
}

export type SubRequestUrgency = 'today' | 'upcoming' | 'open';
export type SubRequestStatus = 'open' | 'closed' | 'cancelled';

export interface SubstituteRequest {
  requestId: string;
  lessonId: string;
  groupId: string;
  groupName: string;
  originalTeacherId: string;
  coverWindow: { from: ISODate; to: ISODate };
  urgency: SubRequestUrgency;
  status: SubRequestStatus;
  lang: LangCode;
  day: Weekday;
  start: HHMM;
  end: HHMM;
}

export type CandidateClass = 'best' | 'good' | 'ok' | 'ineligible';

export interface SubstituteCandidate {
  teacherId: string;
  name: string;
  avatarUrl?: string | null;
  eligible: boolean;
  fitScore: number;
  classification: CandidateClass;
  factors: {
    canLang: boolean;
    free: boolean;
    spareRatio: number;
    familiar: boolean;
    wouldOverload: boolean;
    subLoop?: boolean;
  };
}

export type UnitStatus = 'planned' | 'active' | 'done' | 'overridden';

export interface CurriculumUnit {
  unitId: string;
  title: string;
  order: number;
  plannedSessions: number;
  deliveredSessions: number;
  /** Unit of the linked course this plan unit teaches; null while unstitched. */
  contentUnitId: string | null;
  requiredLevel: CEFR;
  status: UnitStatus;
}

export interface CurriculumPlan {
  planId: string;
  groupId: string;
  units: CurriculumUnit[];
  targetWeeklyHours: number;
  progressPct: number;
}

export interface ForecastParams {
  growth: number;
  terms: number;
  groupSize: number;
  hoursPerGroup: number;
  contractPerTeacher: number;
}

export interface ForecastResult {
  projection: Array<{ term: number; teachersNeeded: number; contactHours: number }>;
  perLanguage: Array<{
    lang: LangCode;
    teachersNeeded: number;
    teachersHaving: number;
    gap: number;
    utilProjected: number;
    risk: 'low' | 'medium' | 'high';
  }>;
  bottleneck: { lang: LangCode; utilProjected: number } | null;
  hireGap: number;
}

export interface ForecastScenario {
  scenarioId: string;
  name: string;
  params: ForecastParams;
  result: ForecastResult;
}

export type AlertSeverity = 'danger' | 'warn';
export type AlertKind =
  | 'overload'
  | 'near-cap'
  | 'daily-breach'
  | 'conflict'
  | 'vacancy'
  | 'uncovered'
  | 'sub-overload'
  | 'bottleneck';
export type AlertState = 'raised' | 'acknowledged' | 'resolved';

export interface Alert {
  alertId: string;
  kind: AlertKind;
  severity: AlertSeverity;
  state: AlertState;
  teacherId?: string;
  groupId?: string;
  message: string;
  occurredAt: string;
}

// ── Workload projection types (used by BFF command-center) ────────────────────

export interface WorkloadKpis {
  utilizationAvgPct: number;
  spareCapacityHours: number;
  overloadedCount: number;
  clashCount: number;
  vacancyCount: number;
}

export interface TeacherLoadRow {
  teacherId: string;
  name: string;
  avatarUrl?: string | null;
  languages: LangCode[];
  contactHours: number;
  prepHours: number;
  effectiveLoad: number;
  utilizationPct: number;
  healthState: HealthState;
  groupCount: number;
  conflictCount: number;
  maxWeeklyContactHours: number;
}

export interface Vacancy {
  groupId: string;
  groupName: string;
  lang: LangCode;
  kind: 'no-primary' | 'uncovered-absence';
}

export interface RoomLoad {
  room: string;
  utilizationPct: number;
  sessionCount: number;
}

// ── Roster view model ─────────────────────────────────────────────────────────

export type RosterStatus = 'active' | 'pending' | 'suspended';

export interface TeacherRosterRow {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  languages: LangCode[];
  role: 'TEACHER';
  status: RosterStatus;
  maxWeeklyHours: number;
  joinedAt: string;
}

export interface ForecastBaseline {
  studentCount: number;
  activeTeacherCount: number;
  perLanguage: Array<{
    lang: LangCode;
    teacherCount: number;
    groupCount: number;
    studentCount: number;
  }>;
}

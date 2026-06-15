import type { Slot, Lesson, TimetableTeacher, OpsWarning } from '@/features/groups/types';
import type {
  AvailabilityBlock,
  Absence,
  SubstituteRequest,
  SubstituteCandidate,
  CurriculumPlan,
  ForecastParams,
  ForecastResult,
  WorkloadKpis,
  TeacherLoadRow,
  Vacancy,
  RoomLoad,
  Alert,
} from '@/features/teachers/types';

export type MutationResult =
  | { ok: true; warnings?: string[] }
  | { ok: false; error: string; details?: unknown };

export interface CommandCenterData {
  kpis: WorkloadKpis;
  teachers: TeacherLoadRow[];
  violations: Alert[];
  vacancies: Vacancy[];
  roomLoad: RoomLoad[];
}

export interface SchedulingProvider {
  // ── existing (groups) ──────────────────────────────────────────────────────
  getSlots(groupId: string): Promise<Slot[]>;
  putSlots(groupId: string, slots: Slot[]): Promise<void>;
  nextLessons(groupId: string, limit: number): Promise<Lesson[]>;
  teacherTimetable(schoolId: string): Promise<TimetableTeacher[]>;
  teacherConflicts(schoolId: string): Promise<OpsWarning[]>;
  studentClashes(schoolId: string, userId: string): Promise<OpsWarning[]>;

  // ── roster / load projection ───────────────────────────────────────────────
  commandCenter(schoolId: string): Promise<CommandCenterData>;

  // ── availability & absence ─────────────────────────────────────────────────
  getAvailability(teacherId: string): Promise<AvailabilityBlock[]>;
  putAvailability(teacherId: string, blocks: AvailabilityBlock[]): Promise<void>;
  listAbsences(schoolId: string): Promise<Absence[]>;
  reportAbsence(input: {
    schoolId: string;
    teacherId: string;
    kind: Absence['kind'];
    scope: Absence['scope'];
    from: string;
    to: string | null;
    reason: string;
  }): Promise<{ absenceId: string; createdRequests: SubstituteRequest[] }>;

  // ── substitution ───────────────────────────────────────────────────────────
  coverQueue(schoolId: string): Promise<SubstituteRequest[]>;
  candidates(requestId: string): Promise<SubstituteCandidate[]>;
  assignSubstitute(
    requestId: string,
    substituteTeacherId: string,
    override?: boolean,
  ): Promise<MutationResult>;

  // ── curriculum ────────────────────────────────────────────────────────────
  getCurriculum(groupId: string): Promise<CurriculumPlan>;
  putCurriculum(groupId: string, plan: CurriculumPlan): Promise<void>;

  // ── forecast ──────────────────────────────────────────────────────────────
  computeForecast(schoolId: string, params: ForecastParams): Promise<ForecastResult>;
}

export function getSchedulingProvider(): SchedulingProvider {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./real').realProvider as SchedulingProvider;
}

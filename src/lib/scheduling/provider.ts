import type {
  Slot,
  Lesson,
  OpsWarning,
  TeacherAvailability,
  RawTimetableEntry,
  RawSchoolTimetableEntry,
} from '@/features/groups/types';
import type {
  AvailabilityBlock,
  Absence,
  SubstituteRequest,
  SubstituteCandidate,
  CurriculumPlan,
  ForecastParams,
  ForecastResult,
} from '@/features/teachers/types';

export type MutationResult =
  | { ok: true; warnings?: string[] }
  | { ok: false; error: string; details?: unknown };

export interface SchedulingProvider {
  // ── existing (groups) ──────────────────────────────────────────────────────
  getSlots(schoolId: string, groupId: string): Promise<Slot[]>;
  putSlots(schoolId: string, groupId: string, slots: Slot[]): Promise<void>;
  /** Derived per-teacher availability (free/conflict/absent) for a proposed weekly slot set. */
  teachersAvailability(
    schoolId: string,
    slots: Array<Pick<Slot, 'day' | 'start' | 'end'>>,
  ): Promise<TeacherAvailability[]>;
  nextLessons(groupId: string, limit: number): Promise<Lesson[]>;
  /** Lessons of one group between two ISO dates, whatever their status. */
  lessonsInRange(groupId: string, from: string, to: string): Promise<Lesson[]>;
  /** Record that a lesson actually happened, and which unit of the plan it taught. */
  markLessonHeld(lessonId: string, curriculumUnitId: string): Promise<MutationResult>;
  /** Raw projection of every teacher's assigned future lessons — one query for the whole school. */
  schoolTimetable(schoolId: string): Promise<RawSchoolTimetableEntry[]>;
  /** Raw projection of a single teacher's assigned future lessons. */
  teacherWeek(schoolId: string, teacherId: string): Promise<RawTimetableEntry[]>;
  teacherConflicts(schoolId: string): Promise<OpsWarning[]>;
  studentClashes(schoolId: string, userId: string): Promise<OpsWarning[]>;

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
  candidates(schoolId: string, requestId: string): Promise<SubstituteCandidate[]>;
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

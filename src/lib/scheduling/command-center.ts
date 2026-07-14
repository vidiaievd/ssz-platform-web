import 'server-only';

import { getSchoolTeachersResult, getTimetable } from '@/features/groups/api/queries';
import type { TeacherLoadRow, WorkloadKpis } from '@/features/teachers/types';
import { prepHours, effectiveLoad, dayPeak, consecPeak, healthState } from '@/lib/groups/operations';

export interface CommandCenterComposite {
  kpis: WorkloadKpis;
  teachers: TeacherLoadRow[];
  violations: never[];
  vacancies: never[];
  roomLoad: never[];
  teachersError: string | null;
}

/**
 * Composite over org-service (roster) and scheduling-service (timetable
 * projection): teacher load rows plus school-level workload KPIs. Shared by
 * the command-center and teachers BFF routes.
 */
export async function buildCommandCenter(schoolId: string): Promise<CommandCenterComposite> {
  const [{ teachers: orgTeachers, error: teachersError }, timetableResult] = await Promise.all([
    getSchoolTeachersResult(schoolId),
    getTimetable(schoolId),
  ]);

  const timetableByTeacher = new Map(
    ('data' in timetableResult ? timetableResult.data : []).map((tt) => [tt.userId, tt]),
  );

  const teachers: TeacherLoadRow[] = orgTeachers.map((t) => {
    const tt = timetableByTeacher.get(t.userId);
    const contactHours = tt?.hours ?? 0;
    const prep = prepHours(contactHours, tt?.groups ?? 0);
    const slots = (tt?.lessons ?? []).map((l) => ({ day: l.day, start: l.start, end: l.end, room: '' }));

    return {
      teacherId: t.userId,
      name: t.name,
      avatarUrl: t.avatarUrl,
      languages: t.langs,
      contactHours,
      prepHours: prep,
      effectiveLoad: effectiveLoad(contactHours, prep),
      utilizationPct: tt?.pct ?? 0,
      healthState: healthState(contactHours, t.maxWeeklyHours, tt?.conflicts ?? 0, dayPeak(slots), consecPeak(slots)),
      groupCount: tt?.groups ?? 0,
      conflictCount: tt?.conflicts ?? 0,
      maxWeeklyContactHours: t.maxWeeklyHours,
    };
  });

  const kpis: WorkloadKpis = {
    utilizationAvgPct: teachers.length
      ? Math.round(teachers.reduce((sum, t) => sum + t.utilizationPct, 0) / teachers.length)
      : 0,
    spareCapacityHours: teachers.reduce((sum, t) => sum + Math.max(0, t.maxWeeklyContactHours - t.contactHours), 0),
    overloadedCount: teachers.filter((t) => t.contactHours > t.maxWeeklyContactHours).length,
    clashCount: teachers.filter((t) => t.conflictCount > 0).length,
    vacancyCount: 0,
  };

  return { kpis, teachers, violations: [], vacancies: [], roomLoad: [], teachersError };
}

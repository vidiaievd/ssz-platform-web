import { type NextRequest, NextResponse } from 'next/server';

import { getSchoolTeachersResult, getTimetable } from '@/features/groups/api/queries';
import type { TeacherLoadRow, WorkloadKpis } from '@/features/teachers/types';
import { prepHours, effectiveLoad, dayPeak, consecPeak, healthState } from '@/lib/groups/operations';
import { handleBffError } from '../../_bff-helpers';

type Params = { params: Promise<{ id: string }> };

/**
 * Composite BFF endpoint: assembles workload KPIs and teacher roster rows.
 * Teacher list/roster fields (name, langs, maxWeeklyHours) come from the org
 * service; load/conflict metrics are projected from scheduling-service via
 * getTimetable, the same composition used by the timetable page.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const [{ teachers: orgTeachers, error: teachersError }, timetableResult] = await Promise.all([
      getSchoolTeachersResult(id),
      getTimetable(id),
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

    return NextResponse.json({
      kpis,
      teachers,
      violations: [],
      vacancies: [],
      roomLoad: [],
      teachersError,
    });
  } catch (e) {
    return handleBffError(e, 'Failed to fetch command center');
  }
}

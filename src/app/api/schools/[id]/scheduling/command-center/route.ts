import { type NextRequest, NextResponse } from 'next/server';

import { getSchoolTeachers } from '@/features/groups/api/queries';
import type { TeacherLoadRow, WorkloadKpis } from '@/features/teachers/types';
import { handleBffError } from '../../_bff-helpers';

type Params = { params: Promise<{ id: string }> };

/**
 * Composite BFF endpoint: assembles workload KPIs and teacher roster rows.
 * Teacher list comes from the org service (source of truth for membership).
 * Scheduling metrics (load, utilization) will be overlaid once scheduling-service is ready.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const orgTeachers = await getSchoolTeachers(id);

    const teachers: TeacherLoadRow[] = orgTeachers.map((t) => ({
      teacherId: t.userId,
      name: t.name,
      avatarUrl: t.avatarUrl,
      languages: t.langs,
      contactHours: 0,
      prepHours: 0,
      effectiveLoad: 0,
      utilizationPct: 0,
      healthState: 'ok',
      groupCount: 0,
      conflictCount: 0,
      maxWeeklyContactHours: t.maxWeeklyHours,
    }));

    const kpis: WorkloadKpis = {
      utilizationAvgPct: 0,
      spareCapacityHours: orgTeachers.reduce((sum, t) => sum + t.maxWeeklyHours, 0),
      overloadedCount: 0,
      clashCount: 0,
      vacancyCount: 0,
    };

    return NextResponse.json({ kpis, teachers, violations: [], vacancies: [], roomLoad: [] });
  } catch (e) {
    return handleBffError(e, 'Failed to fetch command center');
  }
}

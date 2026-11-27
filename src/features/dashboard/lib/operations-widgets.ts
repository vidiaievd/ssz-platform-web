import type { GroupHealthRowVM } from '@/features/groups/types';
import type { TeacherLoadRow, WorkloadKpis } from '@/features/teachers/types';

import type { DashboardRole, GroupsHealthData, Kpi, TeacherWorkloadData, WidgetData } from '../types';

/**
 * The dashboard's two operations widgets, read from the services that own the facts
 * (OQ-108). They used to ask analytics for `dashboard/groups-health` and
 * `dashboard/teacher-load`, which were never built: both cards said "temporarily
 * unavailable", the group counter stayed 0 and «groups without a lead» never showed.
 *
 * - Groups come from the groups page's own reading (`getGroups`: organization's groups +
 *   scheduling's slots, alerts by `groupAlerts`), so the card and the page agree.
 * - Load comes from the teachers screen's composite (`buildCommandCenter`).
 */


export function groupsHealthWidget(
  result: { groups: GroupHealthRowVM[]; unavailable?: boolean },
  viewer: { role: DashboardRole; userId: string | null },
): WidgetData<GroupsHealthData> {
  if (result.unavailable) return { status: 'unavailable' };

  const groups = result.groups
    .filter((g) => !g.isDefault && g.status === 'active')
    // A teacher's card is "My groups": the ones they teach today, in any role.
    .filter((g) => viewer.role !== 'teacher' || (viewer.userId !== null && (g.teacherIds ?? []).includes(viewer.userId)));

  if (groups.length === 0) return { status: 'empty' };

  return {
    status: 'ok',
    data: {
      activeCount: groups.length,
      attentionCount: groups.filter((g) => g.alerts.length > 0).length,
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        lang: g.lang,
        level: g.level,
        primaryTeacherName: g.primaryTeacher?.name || null,
        studentCount: g.studentCount,
        // The dashboard card's `max` 0 = no ceiling.
        max: g.capacity.max ?? 0,
        alerts: g.alerts,
      })),
    },
  };
}

export function teacherWorkloadWidget(
  composite: { kpis: WorkloadKpis; teachers: TeacherLoadRow[]; teachersError: string | null },
): WidgetData<TeacherWorkloadData> {
  // The roster itself could not be read: an empty list would claim the school has no teachers.
  if (composite.teachersError !== null && composite.teachers.length === 0) return { status: 'unavailable' };
  if (composite.teachers.length === 0) return { status: 'empty' };

  return {
    status: 'ok',
    data: {
      overloadedCount: composite.kpis.overloadedCount,
      avgLoadPct: composite.kpis.utilizationAvgPct,
      // Teachers with a clash, as the teachers screen counts them.
      conflictCount: composite.kpis.clashCount,
      teachers: composite.teachers.map((t) => ({
        id: t.teacherId,
        name: t.name,
        avatarUrl: t.avatarUrl ?? null,
        hours: t.contactHours,
        max: t.maxWeeklyContactHours,
        pct: t.utilizationPct,
        overloaded: t.contactHours > t.maxWeeklyContactHours,
        groups: t.groupCount,
        langs: t.languages,
        conflicts: t.conflictCount,
        lessons: t.lessonsPerWeek,
      })),
    },
  };
}

/**
 * The KPI tiles analytics does not serve — groups and load — counted from the two cards
 * above and laid over analytics' own tiles. Before, `active_groups`, `avg_teacher_load`,
 * `scheduling_conflicts` and every teacher tile read "—" for good.
 *
 * A card that could not be read adds nothing, so its tiles stay "—"; an empty card is 0.
 * `my_students` adds up the head counts of the teacher's groups, so a learner in two of
 * them counts twice.
 */
export function operationsKpis(
  groups: WidgetData<GroupsHealthData>,
  load: WidgetData<TeacherWorkloadData>,
  viewer: { role: DashboardRole; userId: string | null },
): Kpi[] {
  const out: Kpi[] = [];
  const groupRows = groups.status === 'ok' ? groups.data.groups : [];
  const groupsKnown = groups.status !== 'unavailable';
  const loadKnown = load.status !== 'unavailable';

  if (viewer.role === 'teacher') {
    if (groupsKnown) {
      out.push({ key: 'my_groups', value: groupRows.length });
      out.push({ key: 'my_students', value: groupRows.reduce((sum, g) => sum + g.studentCount, 0) });
    }
    const mine = load.status === 'ok' ? load.data.teachers.find((t) => t.id === viewer.userId) : undefined;
    if (mine) {
      out.push({ key: 'lessons_per_week', value: mine.lessons ?? 0 });
      out.push({ key: 'my_load', value: mine.pct, unit: '%' });
    }
    return out;
  }

  if (groupsKnown) out.push({ key: 'active_groups', value: groupRows.length });
  if (loadKnown) {
    const data = load.status === 'ok' ? load.data : null;
    out.push({ key: 'avg_teacher_load', value: data?.avgLoadPct ?? 0, unit: '%' });
    out.push({ key: 'scheduling_conflicts', value: data?.conflictCount ?? 0 });
  }
  return out;
}

/** Analytics' tiles with the operations tiles laid over them (a key in both: ours wins). */
export function withOperationsKpis(analytics: WidgetData<Kpi[]>, extra: Kpi[]): WidgetData<Kpi[]> {
  if (extra.length === 0) return analytics;
  const keys = new Set(extra.map((k) => k.key));
  const base = analytics.status === 'ok' ? analytics.data.filter((k) => !keys.has(k.key)) : [];
  return { status: 'ok', data: [...base, ...extra] };
}

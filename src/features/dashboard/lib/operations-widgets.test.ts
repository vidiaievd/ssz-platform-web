import { describe, expect, it } from 'vitest';

import type { GroupHealthRowVM } from '@/features/groups/types';
import type { TeacherLoadRow, WorkloadKpis } from '@/features/teachers/types';

import { groupsHealthWidget, operationsKpis, teacherWorkloadWidget, withOperationsKpis } from './operations-widgets';

const group = (over: Partial<GroupHealthRowVM> = {}): GroupHealthRowVM => ({
  id: 'g1',
  name: 'Norsk A2',
  lang: 'nb',
  level: 'A2',
  courseName: null,
  status: 'active',
  mode: 'online',
  primaryTeacher: { name: 'Kari' },
  coPrimaryTeacher: null,
  slots: [],
  studentCount: 8,
  capacity: { min: 0, max: 12 },
  alerts: [],
  teacherIds: ['t1'],
  isDefault: false,
  ...over,
});

const KPIS: WorkloadKpis = { utilizationAvgPct: 64, spareCapacityHours: 10, overloadedCount: 1, clashCount: 2, vacancyCount: 0 };

const row = (over: Partial<TeacherLoadRow> = {}): TeacherLoadRow => ({
  teacherId: 't1',
  name: 'Kari',
  avatarUrl: null,
  languages: ['nb'],
  contactHours: 22,
  prepHours: 5,
  effectiveLoad: 27,
  utilizationPct: 110,
  healthState: 'danger',
  groupCount: 3,
  conflictCount: 1,
  maxWeeklyContactHours: 20,
  lessonsPerWeek: 11,
  ...over,
});

const owner = { role: 'owner' as const, userId: 'o1' };
const teacher = { role: 'teacher' as const, userId: 't1' };

describe('groupsHealthWidget', () => {
  it('counts active groups and those needing attention, leaving out drafts, archived and hidden groups', () => {
    const w = groupsHealthWidget(
      {
        groups: [
          group(),
          group({ id: 'g2', primaryTeacher: null, alerts: [{ type: 'no-primary', severity: 'danger', label: '' }] }),
          group({ id: 'g3', status: 'draft' }),
          group({ id: 'g4', status: 'archived' }),
          group({ id: 'g5', isDefault: true }),
        ],
      },
      owner,
    );
    expect(w.status).toBe('ok');
    if (w.status !== 'ok') return;
    expect(w.data.activeCount).toBe(2);
    expect(w.data.attentionCount).toBe(1);
    expect(w.data.groups.map((g) => g.id)).toEqual(['g1', 'g2']);
    expect(w.data.groups[1]!.primaryTeacherName).toBeNull();
  });

  it('gives a teacher only the groups they teach today', () => {
    const w = groupsHealthWidget({ groups: [group(), group({ id: 'g2', teacherIds: ['t2'] })] }, teacher);
    expect(w.status === 'ok' && w.data.groups.map((g) => g.id)).toEqual(['g1']);
    expect(groupsHealthWidget({ groups: [group({ teacherIds: ['t2'] })] }, teacher)).toEqual({ status: 'empty' });
  });

  it('shows no ceiling for a group without capacity', () => {
    const w = groupsHealthWidget({ groups: [group({ capacity: { min: 0, max: null } })] }, owner);
    expect(w.status === 'ok' && w.data.groups[0]!.max).toBe(0);
  });

  it('tells an unreadable organization from a school without groups', () => {
    expect(groupsHealthWidget({ groups: [], unavailable: true }, owner)).toEqual({ status: 'unavailable' });
    expect(groupsHealthWidget({ groups: [] }, owner)).toEqual({ status: 'empty' });
  });
});

describe('teacherWorkloadWidget', () => {
  it('maps the teachers screen composite', () => {
    const w = teacherWorkloadWidget({ kpis: KPIS, teachers: [row()], teachersError: null });
    expect(w).toEqual({
      status: 'ok',
      data: {
        overloadedCount: 1,
        avgLoadPct: 64,
        conflictCount: 2,
        teachers: [
          {
            id: 't1',
            name: 'Kari',
            avatarUrl: null,
            hours: 22,
            max: 20,
            pct: 110,
            overloaded: true,
            groups: 3,
            langs: ['nb'],
            conflicts: 1,
            lessons: 11,
          },
        ],
      },
    });
  });

  it('is unavailable when the roster failed, empty when there is nobody', () => {
    expect(teacherWorkloadWidget({ kpis: KPIS, teachers: [], teachersError: 'down' })).toEqual({ status: 'unavailable' });
    expect(teacherWorkloadWidget({ kpis: KPIS, teachers: [], teachersError: null })).toEqual({ status: 'empty' });
  });
});

describe('operationsKpis', () => {
  const groups = groupsHealthWidget({ groups: [group(), group({ id: 'g2', studentCount: 4 })] }, owner);
  const load = teacherWorkloadWidget({ kpis: KPIS, teachers: [row()], teachersError: null });

  it('fills the owner tiles from groups and load', () => {
    expect(operationsKpis(groups, load, owner)).toEqual([
      { key: 'active_groups', value: 2 },
      { key: 'avg_teacher_load', value: 64, unit: '%' },
      { key: 'scheduling_conflicts', value: 2 },
    ]);
  });

  it("fills the teacher's own tiles", () => {
    expect(operationsKpis(groups, load, teacher)).toEqual([
      { key: 'my_groups', value: 2 },
      { key: 'my_students', value: 12 },
      { key: 'lessons_per_week', value: 11 },
      { key: 'my_load', value: 110, unit: '%' },
    ]);
  });

  it('adds nothing for an unreadable card, zero for an empty one', () => {
    expect(operationsKpis({ status: 'unavailable' }, { status: 'unavailable' }, owner)).toEqual([]);
    expect(operationsKpis({ status: 'empty' }, { status: 'empty' }, owner)).toEqual([
      { key: 'active_groups', value: 0 },
      { key: 'avg_teacher_load', value: 0, unit: '%' },
      { key: 'scheduling_conflicts', value: 0 },
    ]);
  });
});

describe('withOperationsKpis', () => {
  it('lays the operations tiles over analytics', () => {
    const merged = withOperationsKpis(
      { status: 'ok', data: [{ key: 'active_students_7d', value: 5 }, { key: 'active_groups', value: 0 }] },
      [{ key: 'active_groups', value: 3 }],
    );
    expect(merged).toEqual({
      status: 'ok',
      data: [{ key: 'active_students_7d', value: 5 }, { key: 'active_groups', value: 3 }],
    });
  });

  it('still shows the operations tiles when analytics is down, and leaves analytics alone without them', () => {
    expect(withOperationsKpis({ status: 'unavailable' }, [{ key: 'active_groups', value: 3 }])).toEqual({
      status: 'ok',
      data: [{ key: 'active_groups', value: 3 }],
    });
    expect(withOperationsKpis({ status: 'unavailable' }, [])).toEqual({ status: 'unavailable' });
  });
});

// @vitest-environment node

import { describe, it, expect } from 'vitest';

import {
  slotsOverlap,
  groupAlerts,
  teacherConflicts,
  teacherLoad,
  projectedCapacity,
  type GroupForOps,
  type Slot,
} from './operations';

// ── slotsOverlap ──────────────────────────────────────────────────────────────

describe('slotsOverlap', () => {
  const slot = (day: string, start: string, end: string): Slot =>
    ({ day, start, end, room: '' }) as Slot;

  it('returns false for different days', () => {
    expect(slotsOverlap(slot('Mon', '09:00', '10:00'), slot('Tue', '09:00', '10:00'))).toBe(false);
  });

  it('returns false when slots are adjacent (no gap)', () => {
    expect(slotsOverlap(slot('Mon', '09:00', '10:00'), slot('Mon', '10:00', '11:00'))).toBe(false);
  });

  it('returns false when first ends before second starts', () => {
    expect(slotsOverlap(slot('Mon', '08:00', '09:00'), slot('Mon', '10:00', '11:00'))).toBe(false);
  });

  it('returns true for full overlap (one inside other)', () => {
    expect(slotsOverlap(slot('Wed', '09:00', '11:00'), slot('Wed', '09:30', '10:30'))).toBe(true);
  });

  it('returns true for partial overlap from the left', () => {
    expect(slotsOverlap(slot('Mon', '18:00', '19:30'), slot('Mon', '18:30', '20:00'))).toBe(true);
  });

  it('returns true for partial overlap from the right', () => {
    expect(slotsOverlap(slot('Fri', '10:00', '11:30'), slot('Fri', '09:00', '10:30'))).toBe(true);
  });

  it('returns true for identical slots', () => {
    expect(slotsOverlap(slot('Thu', '14:00', '15:00'), slot('Thu', '14:00', '15:00'))).toBe(true);
  });
});

// ── groupAlerts ───────────────────────────────────────────────────────────────

describe('groupAlerts', () => {
  const makeGroup = (overrides: Partial<GroupForOps>): GroupForOps => ({
    id: 'group-1',
    status: 'active',
    primaryTeacherId: 'teacher-1',
    coPrimaryTeacherId: null,
    slots: [{ day: 'Mon', start: '09:00', end: '10:30', room: 'Room 1' }],
    studentCount: 8,
    capacity: { min: 5, max: 12 },
    ...overrides,
  });

  it('emits no-primary danger alert when no primary teacher', () => {
    const group = makeGroup({ primaryTeacherId: null });
    const alerts = groupAlerts(group, null, [group]);
    expect(alerts.some((a) => a.type === 'no-primary' && a.severity === 'danger')).toBe(true);
  });

  it('emits over-capacity alert when studentCount > max', () => {
    const group = makeGroup({ studentCount: 15, capacity: { min: 5, max: 12 } });
    const alerts = groupAlerts(group, null, [group]);
    expect(alerts.some((a) => a.type === 'over')).toBe(true);
  });

  it('emits under-minimum warn when studentCount < min', () => {
    const group = makeGroup({ studentCount: 2, capacity: { min: 5, max: 12 } });
    const alerts = groupAlerts(group, null, [group]);
    expect(alerts.some((a) => a.type === 'under' && a.severity === 'warn')).toBe(true);
  });

  it('emits overload warn when teacher hours exceed max', () => {
    // Group with 3 × 1.5h slots = 4.5h/week; max = 4h → overloaded
    const group = makeGroup({
      slots: [
        { day: 'Mon', start: '09:00', end: '10:30', room: 'R' },
        { day: 'Tue', start: '09:00', end: '10:30', room: 'R' },
        { day: 'Wed', start: '09:00', end: '10:30', room: 'R' },
      ],
    });
    const alerts = groupAlerts(group, 4, [group]);
    expect(alerts.some((a) => a.type === 'overload' && a.severity === 'warn')).toBe(true);
  });

  it('emits conflict alert when teacher has same-day overlap with another group', () => {
    const groupA: GroupForOps = {
      id: 'g-a', status: 'active',
      primaryTeacherId: 'teacher-x', coPrimaryTeacherId: null,
      slots: [{ day: 'Mon', start: '18:00', end: '19:30', room: 'R1' }],
      studentCount: 5, capacity: { min: 3, max: 10 },
    };
    const groupB: GroupForOps = {
      id: 'g-b', status: 'active',
      primaryTeacherId: 'teacher-x', coPrimaryTeacherId: null,
      slots: [{ day: 'Mon', start: '18:30', end: '20:00', room: 'R2' }],
      studentCount: 4, capacity: { min: 3, max: 10 },
    };
    const alertsA = groupAlerts(groupA, null, [groupA, groupB]);
    expect(alertsA.some((a) => a.type === 'conflict')).toBe(true);
  });

  it('returns no alerts for a healthy group', () => {
    const group = makeGroup({ studentCount: 8 });
    const alerts = groupAlerts(group, 20, [group]);
    expect(alerts).toHaveLength(0);
  });

  it('detects conflict regardless of group status (caller must pre-filter to active if needed)', () => {
    const active: GroupForOps = {
      id: 'active', status: 'active',
      primaryTeacherId: 'teacher-x', coPrimaryTeacherId: null,
      slots: [{ day: 'Tue', start: '10:00', end: '11:30', room: '' }],
      studentCount: 5, capacity: { min: 3, max: 10 },
    };
    const draft: GroupForOps = {
      id: 'draft', status: 'draft',
      primaryTeacherId: 'teacher-x', coPrimaryTeacherId: null,
      slots: [{ day: 'Tue', start: '10:00', end: '11:30', room: '' }],
      studentCount: 0, capacity: { min: 0, max: 10 },
    };
    // groupAlerts checks all groups passed — callers should filter to active-only
    const alerts = groupAlerts(active, null, [active, draft]);
    expect(alerts.some((a) => a.type === 'conflict')).toBe(true);

    // When only active groups are passed, no conflict with a non-overlapping draft
    const noConflictGroup: GroupForOps = {
      id: 'other', status: 'active',
      primaryTeacherId: 'teacher-x', coPrimaryTeacherId: null,
      slots: [{ day: 'Thu', start: '10:00', end: '11:30', room: '' }],
      studentCount: 0, capacity: { min: 0, max: 10 },
    };
    const alertsClean = groupAlerts(active, null, [active, noConflictGroup]);
    expect(alertsClean.some((a) => a.type === 'conflict')).toBe(false);
  });
});

// ── teacherConflicts ──────────────────────────────────────────────────────────

describe('teacherConflicts', () => {
  it('counts 0 conflicts when teacher has no groups', () => {
    expect(teacherConflicts('teacher-x', [])).toBe(0);
  });

  it('counts 0 conflicts when slots do not overlap', () => {
    const groups: GroupForOps[] = [
      {
        id: 'g1', status: 'active', primaryTeacherId: 'teacher-x', coPrimaryTeacherId: null,
        slots: [{ day: 'Mon', start: '09:00', end: '10:00', room: '' }],
        studentCount: 5, capacity: { min: 0, max: 10 },
      },
      {
        id: 'g2', status: 'active', primaryTeacherId: 'teacher-x', coPrimaryTeacherId: null,
        slots: [{ day: 'Mon', start: '11:00', end: '12:00', room: '' }],
        studentCount: 5, capacity: { min: 0, max: 10 },
      },
    ];
    expect(teacherConflicts('teacher-x', groups)).toBe(0);
  });

  it('counts 1 conflict pair for overlapping slots', () => {
    const groups: GroupForOps[] = [
      {
        id: 'g1', status: 'active', primaryTeacherId: 'teacher-x', coPrimaryTeacherId: null,
        slots: [{ day: 'Mon', start: '18:00', end: '19:30', room: '' }],
        studentCount: 5, capacity: { min: 0, max: 10 },
      },
      {
        id: 'g2', status: 'active', primaryTeacherId: 'teacher-x', coPrimaryTeacherId: null,
        slots: [{ day: 'Mon', start: '18:30', end: '20:00', room: '' }],
        studentCount: 5, capacity: { min: 0, max: 10 },
      },
    ];
    expect(teacherConflicts('teacher-x', groups)).toBe(1);
  });

  it('does not count other teachers slots', () => {
    const groups: GroupForOps[] = [
      {
        id: 'g1', status: 'active', primaryTeacherId: 'teacher-x', coPrimaryTeacherId: null,
        slots: [{ day: 'Mon', start: '09:00', end: '10:00', room: '' }],
        studentCount: 5, capacity: { min: 0, max: 10 },
      },
      {
        id: 'g2', status: 'active', primaryTeacherId: 'teacher-y', coPrimaryTeacherId: null,
        slots: [{ day: 'Mon', start: '09:00', end: '10:00', room: '' }],
        studentCount: 5, capacity: { min: 0, max: 10 },
      },
    ];
    expect(teacherConflicts('teacher-x', groups)).toBe(0);
  });
});

// ── teacherLoad ───────────────────────────────────────────────────────────────

describe('teacherLoad', () => {
  const g = (id: string, slots: Slot[]): GroupForOps => ({
    id, status: 'active', primaryTeacherId: 'teacher-1', coPrimaryTeacherId: null,
    slots, studentCount: 5, capacity: { min: 0, max: 10 },
  });

  it('calculates hours correctly for multiple slots', () => {
    const groups = [
      g('g1', [{ day: 'Mon', start: '09:00', end: '10:30', room: '' }]),  // 1.5h
      g('g2', [{ day: 'Wed', start: '14:00', end: '16:00', room: '' }]),  // 2h
    ];
    const result = teacherLoad({ id: 'teacher-1', maxWeeklyHours: 20 }, groups);
    expect(result.hours).toBeCloseTo(3.5);
    expect(result.pct).toBe(Math.round(3.5 / 20 * 100));
    expect(result.overloaded).toBe(false);
  });

  it('marks overloaded when hours exceed max', () => {
    const groups = [
      g('g1', [
        { day: 'Mon', start: '08:00', end: '10:00', room: '' },
        { day: 'Tue', start: '08:00', end: '10:00', room: '' },
        { day: 'Wed', start: '08:00', end: '10:00', room: '' },
      ]), // 6h
    ];
    const result = teacherLoad({ id: 'teacher-1', maxWeeklyHours: 4 }, groups);
    expect(result.overloaded).toBe(true);
  });

  it('counts groups correctly', () => {
    const groups = [
      g('g1', [{ day: 'Mon', start: '09:00', end: '10:00', room: '' }]),
      g('g2', [{ day: 'Tue', start: '09:00', end: '10:00', room: '' }]),
    ];
    const result = teacherLoad({ id: 'teacher-1', maxWeeklyHours: 20 }, groups);
    expect(result.groups).toBe(2);
  });

  it('returns zero hours for teacher with no groups', () => {
    const result = teacherLoad({ id: 'teacher-1', maxWeeklyHours: 20 }, []);
    expect(result.hours).toBe(0);
    expect(result.groups).toBe(0);
    expect(result.overloaded).toBe(false);
  });
});

// ── projectedCapacity ─────────────────────────────────────────────────────────

describe('projectedCapacity', () => {
  const group: GroupForOps = {
    id: 'g', status: 'active', primaryTeacherId: null, coPrimaryTeacherId: null,
    slots: [], studentCount: 8, capacity: { min: 5, max: 12 },
  };

  it('projects count correctly', () => {
    expect(projectedCapacity(group, 3).projected).toBe(11);
  });

  it('withinCapacity when projected is between min and max', () => {
    expect(projectedCapacity(group, 3).withinCapacity).toBe(true);
  });

  it('over when projected exceeds max', () => {
    expect(projectedCapacity(group, 5).over).toBe(true);
    expect(projectedCapacity(group, 5).withinCapacity).toBe(false);
  });

  it('under when projected is below min', () => {
    const emptyGroup: GroupForOps = { ...group, studentCount: 0 };
    expect(projectedCapacity(emptyGroup, 2).under).toBe(true);
  });

  it('exact max is not over', () => {
    expect(projectedCapacity(group, 4).over).toBe(false);
    expect(projectedCapacity(group, 4).projected).toBe(12);
  });
});

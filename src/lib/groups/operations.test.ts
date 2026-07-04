// @vitest-environment node

import { describe, it, expect } from 'vitest';

import {
  slotsOverlap,
  groupAlerts,
  teacherConflicts,
  teacherLoad,
  projectedCapacity,
  prepHours,
  effectiveLoad,
  dayPeak,
  consecPeak,
  healthState,
  withinAvailability,
  validateAssignment,
  scoreCandidate,
  rankCandidates,
  forecast,
  WORKLOAD_POLICY,
  type GroupForOps,
  type Slot,
} from './operations';
import type { AvailabilityBlock } from '@/features/teachers/types';

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

// ── prepHours / effectiveLoad ─────────────────────────────────────────────────

describe('prepHours', () => {
  it('calculates prep from contact and distinct courses', () => {
    expect(prepHours(10, 2)).toBeCloseTo(10 * 0.3 + 2 * 1.0);
  });

  it('zero contact with courses yields course-only prep', () => {
    expect(prepHours(0, 3)).toBeCloseTo(3.0);
  });
});

describe('effectiveLoad', () => {
  it('sums contact and prep', () => {
    expect(effectiveLoad(10, 3)).toBe(13);
  });
});

// ── dayPeak ───────────────────────────────────────────────────────────────────

describe('dayPeak', () => {
  const s = (day: string, start: string, end: string): Slot =>
    ({ day, start, end, room: '' }) as Slot;

  it('returns 0 for empty slots', () => {
    expect(dayPeak([])).toBe(0);
  });

  it('picks the busiest day', () => {
    const slots = [
      s('Mon', '09:00', '10:00'), // 1h
      s('Mon', '11:00', '12:30'), // 1.5h → Mon = 2.5h
      s('Tue', '09:00', '10:00'), // 1h
    ];
    expect(dayPeak(slots)).toBeCloseTo(2.5);
  });
});

// ── consecPeak ────────────────────────────────────────────────────────────────

describe('consecPeak', () => {
  const s = (day: string, start: string, end: string): Slot =>
    ({ day, start, end, room: '' }) as Slot;

  it('returns 0 for empty slots', () => {
    expect(consecPeak([])).toBe(0);
  });

  it('merges adjacent back-to-back slots', () => {
    const slots = [
      s('Mon', '09:00', '10:00'),
      s('Mon', '10:00', '11:30'),
      s('Mon', '12:00', '13:00'), // gap → separate run
    ];
    expect(consecPeak(slots)).toBeCloseTo(2.5);
  });

  it('handles run spanning across midday', () => {
    const slots = [
      s('Tue', '11:00', '12:00'),
      s('Tue', '12:00', '13:30'),
    ];
    expect(consecPeak(slots)).toBeCloseTo(2.5);
  });

  it('consecutive slots on different days are independent runs', () => {
    const slots = [
      s('Mon', '09:00', '11:00'),
      s('Tue', '09:00', '11:00'),
    ];
    expect(consecPeak(slots)).toBeCloseTo(2.0);
  });
});

// ── healthState ───────────────────────────────────────────────────────────────

describe('healthState', () => {
  it('ok when all within limits', () => {
    expect(healthState(6, 10, 0, 3, 3)).toBe('ok');
  });

  it('danger when contact exceeds cap', () => {
    expect(healthState(11, 10, 0, 3, 3)).toBe('danger');
  });

  it('danger when conflict count > 0', () => {
    expect(healthState(5, 10, 1, 3, 3)).toBe('danger');
  });

  it('warn when near cap', () => {
    // 9/10 = 90% ≥ 85% NEAR_CAP_RATIO
    expect(healthState(9, 10, 0, 3, 3)).toBe('warn');
  });

  it('warn when consecPeak exceeds MAX_CONSECUTIVE by 1', () => {
    // cp = MAX_CONSECUTIVE+1 = 5 → warn (danger threshold is > MAX_CONSECUTIVE+1)
    expect(healthState(4, 10, 0, 3, WORKLOAD_POLICY.MAX_CONSECUTIVE + 1)).toBe('warn');
  });

  it('danger when consecPeak exceeds MAX_CONSECUTIVE+1', () => {
    expect(healthState(4, 10, 0, 3, WORKLOAD_POLICY.MAX_CONSECUTIVE + 2)).toBe('danger');
  });
});

// ── withinAvailability ────────────────────────────────────────────────────────

describe('withinAvailability', () => {
  const block = (type: 'available' | 'preferred' | 'unavailable'): AvailabilityBlock => ({
    blockId: 'b1', teacherId: 't1',
    dayOfWeek: 'Mon', startTime: '08:00', endTime: '20:00',
    type, recurring: true, validFrom: null, validTo: null,
  });

  it('returns true when slot fits in available block', () => {
    expect(withinAvailability({ day: 'Mon', start: '09:00', end: '10:00' }, [block('available')])).toBe(true);
  });

  it('returns true when slot fits in preferred block', () => {
    expect(withinAvailability({ day: 'Mon', start: '09:00', end: '10:00' }, [block('preferred')])).toBe(true);
  });

  it('returns false when type is unavailable', () => {
    expect(withinAvailability({ day: 'Mon', start: '09:00', end: '10:00' }, [block('unavailable')])).toBe(false);
  });

  it('returns false when slot exceeds block end', () => {
    expect(withinAvailability({ day: 'Mon', start: '19:00', end: '21:00' }, [block('available')])).toBe(false);
  });

  it('returns false for empty blocks', () => {
    expect(withinAvailability({ day: 'Mon', start: '09:00', end: '10:00' }, [])).toBe(false);
  });
});

// ── validateAssignment ────────────────────────────────────────────────────────

describe('validateAssignment', () => {
  const baseCtx = {
    candidateLangs: ['en'],
    groupLang: 'en',
    candidateSlots: [] as Slot[],
    newSlot: { day: 'Mon' as const, start: '10:00', end: '11:00' },
    availabilityBlocks: [] as AvailabilityBlock[],
    contactHoursAfter: 5,
    cap: 10,
  };

  it('returns ok for a valid assignment', () => {
    expect(validateAssignment(baseCtx)).toEqual({ ok: true });
  });

  it('blocks on language mismatch', () => {
    const ctx = { ...baseCtx, groupLang: 'fr' };
    const result = validateAssignment(ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.conflictType).toBe('language');
  });

  it('blocks when cap exceeded', () => {
    const ctx = { ...baseCtx, contactHoursAfter: 11 };
    const result = validateAssignment(ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.conflictType).toBe('cap_exceeded');
  });

  it('blocks on overlap with existing slot', () => {
    const ctx = {
      ...baseCtx,
      candidateSlots: [{ day: 'Mon' as const, start: '10:30', end: '11:30', room: '' }],
    };
    const result = validateAssignment(ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.conflictType).toBe('overlap');
  });

  it('blocks sub_loop', () => {
    const ctx = { ...baseCtx, isSubLoop: true };
    const result = validateAssignment(ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.conflictType).toBe('sub_loop');
  });
});

// ── scoreCandidate / rankCandidates ───────────────────────────────────────────

const lesson = { lang: 'en', durationHours: 1.5 };
const baseCandidate = {
  teacherId: 't1', name: 'Alice', avatarUrl: null,
  langs: ['en'],
  currentContactHours: 4,
  maxWeeklyContactHours: 10,
  isFreeAtSlot: true,
  isFamiliar: false,
  isSubLoop: false,
};

describe('scoreCandidate', () => {
  it('returns ineligible when candidate does not speak the language', () => {
    const c = { ...baseCandidate, langs: ['fr'] };
    const result = scoreCandidate(c, lesson);
    expect(result.eligible).toBe(false);
    expect(result.classification).toBe('ineligible');
    expect(result.fitScore).toBe(0);
    expect(result.factors.canLang).toBe(false);
  });

  it('returns ineligible when candidate is not free', () => {
    const c = { ...baseCandidate, isFreeAtSlot: false };
    const result = scoreCandidate(c, lesson);
    expect(result.eligible).toBe(false);
    expect(result.factors.free).toBe(false);
  });

  it('classifies best when score ≥ 80', () => {
    const c = { ...baseCandidate, isFamiliar: true, currentContactHours: 0 };
    const result = scoreCandidate(c, lesson);
    expect(result.eligible).toBe(true);
    expect(result.fitScore).toBeGreaterThanOrEqual(80);
    expect(result.classification).toBe('best');
  });

  it('flags wouldOverload when adding lesson exceeds cap', () => {
    const c = { ...baseCandidate, currentContactHours: 9, maxWeeklyContactHours: 10 };
    const result = scoreCandidate(c, lesson); // 9 + 1.5 = 10.5 > 10
    expect(result.factors.wouldOverload).toBe(true);
  });
});

describe('rankCandidates', () => {
  it('sorts eligible before ineligible', () => {
    const pool = [
      { ...baseCandidate, teacherId: 't1', langs: ['fr'] }, // ineligible
      { ...baseCandidate, teacherId: 't2', langs: ['en'] }, // eligible
    ];
    const ranked = rankCandidates(pool, lesson);
    expect(ranked[0]!.eligible).toBe(true);
    expect(ranked[1]!.eligible).toBe(false);
  });

  it('tie-breaks by teacherId when scores are equal', () => {
    const pool = [
      { ...baseCandidate, teacherId: 'tz', currentContactHours: 4 },
      { ...baseCandidate, teacherId: 'ta', currentContactHours: 4 },
    ];
    const ranked = rankCandidates(pool, lesson);
    expect(ranked[0]!.teacherId).toBe('ta');
  });
});

// ── forecast ──────────────────────────────────────────────────────────────────

describe('forecast', () => {
  const baseline = {
    studentCount: 80,
    activeTeacherCount: 3,
    perLanguage: [
      { lang: 'en', teacherCount: 2, groupCount: 3, studentCount: 50 },
      { lang: 'nb', teacherCount: 1, groupCount: 2, studentCount: 30 },
    ],
  };

  const params = {
    growth: 0.2,
    terms: 3,
    groupSize: 10,
    hoursPerGroup: 2,
    contractPerTeacher: 8,
  };

  it('generates projection for each term', () => {
    const result = forecast(params, baseline);
    expect(result.projection).toHaveLength(3);
    expect(result.projection[0]!.term).toBe(1);
  });

  it('compounds growth correctly', () => {
    const result = forecast(params, baseline);
    const term1Students = Math.round(80 * 1.2);
    const term2Students = Math.round(80 * Math.pow(1.2, 2));
    expect(result.projection[0]!.contactHours).toBe(
      Math.ceil(term1Students / 10) * 2,
    );
    expect(result.projection[1]!.contactHours).toBe(
      Math.ceil(term2Students / 10) * 2,
    );
  });

  it('identifies bottleneck as the most strained language', () => {
    const result = forecast(params, baseline);
    expect(result.bottleneck).not.toBeNull();
  });

  it('hireGap is non-negative', () => {
    const result = forecast(params, baseline);
    expect(result.hireGap).toBeGreaterThanOrEqual(0);
  });

  it('zero growth keeps student count flat', () => {
    const zeroGrowth = { ...params, growth: 0 };
    const result = forecast(zeroGrowth, baseline);
    const term1Students = 80; // no growth
    const expectedGroups = Math.ceil(term1Students / 10);
    expect(result.projection[0]!.contactHours).toBe(expectedGroups * 2);
  });
});

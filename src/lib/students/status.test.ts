// @vitest-environment node

import { describe, it, expect } from 'vitest';

import {
  deriveStatus,
  segmentPredicate,
  studentTeachers,
  type StatusInput,
} from './status';
import type { StudentListItem, StudentGroupRef } from '@/features/students/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const GROUP_A: StudentGroupRef = {
  id: 'group-a',
  name: 'French A1',
  lang: 'fr',
  level: 'A1',
  scheduleSummary: 'Mon 18:00',
};

const GROUP_B: StudentGroupRef = {
  id: 'group-b',
  name: 'French B1',
  lang: 'fr',
  level: 'B1',
  scheduleSummary: 'Mon 18:30',
};

function makeInput(overrides: Partial<StatusInput> = {}): StatusInput {
  return {
    groups: [GROUP_A],
    clashes: [],
    progress: 0.5,
    lastSeen: daysAgo(3),
    enrolledAt: daysAgo(30),
    ...overrides,
  };
}

// ── deriveStatus ──────────────────────────────────────────────────────────────

describe('deriveStatus', () => {
  it('returns "clash" when student has overlapping groups', () => {
    const input = makeInput({
      clashes: [{ groupA: 'group-a', groupB: 'group-b', day: 'Mon', time: '18:00' }],
    });
    expect(deriveStatus(input)).toBe('clash');
  });

  it('returns "unassigned" when student has no groups', () => {
    expect(deriveStatus(makeInput({ groups: [] }))).toBe('unassigned');
  });

  it('returns "new" when enrolled 3 days ago (within threshold)', () => {
    expect(deriveStatus(makeInput({ enrolledAt: daysAgo(3) }))).toBe('new');
  });

  it('returns "at-risk" when last seen 20+ days ago and not new', () => {
    const input = makeInput({ lastSeen: daysAgo(20), enrolledAt: daysAgo(60) });
    expect(deriveStatus(input)).toBe('at-risk');
  });

  it('returns "finished" when progress is 1', () => {
    const input = makeInput({ progress: 1, enrolledAt: daysAgo(60), lastSeen: daysAgo(2) });
    expect(deriveStatus(input)).toBe('finished');
  });

  it('returns "active" when no special condition', () => {
    const input = makeInput({ lastSeen: daysAgo(2), enrolledAt: daysAgo(30) });
    expect(deriveStatus(input)).toBe('active');
  });

  it('"clash" takes priority over "unassigned"', () => {
    const input = makeInput({
      groups: [],
      clashes: [{ groupA: 'a', groupB: 'b', day: 'Mon', time: '18:00' }],
    });
    expect(deriveStatus(input)).toBe('clash');
  });

  it('"unassigned" takes priority over "at-risk"', () => {
    const input = makeInput({
      groups: [],
      lastSeen: daysAgo(30),
      enrolledAt: daysAgo(60),
    });
    expect(deriveStatus(input)).toBe('unassigned');
  });
});

// ── segmentPredicate ──────────────────────────────────────────────────────────

function makeStudent(overrides: Partial<StudentListItem> = {}): StudentListItem {
  return {
    userId: 'u1',
    name: 'Test User',
    email: 'test@example.com',
    avatarUrl: null,
    lang: 'en',
    level: 'A1',
    status: 'active',
    groups: [GROUP_A],
    progress: 0.5,
    lastSeen: daysAgo(3),
    enrolledAt: daysAgo(30),
    ...overrides,
  };
}

describe('segmentPredicate', () => {
  it('"all" matches every student', () => {
    const pred = segmentPredicate('all');
    expect(pred(makeStudent({ status: 'clash' }))).toBe(true);
    expect(pred(makeStudent({ status: 'finished' }))).toBe(true);
  });

  it('"at-risk" matches only at-risk students', () => {
    const pred = segmentPredicate('at-risk');
    expect(pred(makeStudent({ status: 'at-risk' }))).toBe(true);
    expect(pred(makeStudent({ status: 'active' }))).toBe(false);
  });

  it('"no-group" matches unassigned students', () => {
    const pred = segmentPredicate('no-group');
    expect(pred(makeStudent({ status: 'unassigned', groups: [] }))).toBe(true);
    expect(pred(makeStudent({ status: 'active', groups: [GROUP_A] }))).toBe(false);
  });

  it('"clash" matches students with clash status', () => {
    const pred = segmentPredicate('clash');
    expect(pred(makeStudent({ status: 'clash' }))).toBe(true);
    expect(pred(makeStudent({ status: 'active' }))).toBe(false);
  });

  it('"multi-group" matches students in 2+ groups', () => {
    const pred = segmentPredicate('multi-group');
    expect(pred(makeStudent({ groups: [GROUP_A, GROUP_B] }))).toBe(true);
    expect(pred(makeStudent({ groups: [GROUP_A] }))).toBe(false);
    expect(pred(makeStudent({ groups: [] }))).toBe(false);
  });

  it('"finished" matches students with 100% progress', () => {
    const pred = segmentPredicate('finished');
    expect(pred(makeStudent({ status: 'finished' }))).toBe(true);
    expect(pred(makeStudent({ status: 'active' }))).toBe(false);
  });
});

// ── studentTeachers ───────────────────────────────────────────────────────────

describe('studentTeachers', () => {
  it('returns empty when no groups', () => {
    expect(studentTeachers([])).toEqual([]);
  });

  it('deduplicates teachers across groups', () => {
    const teacher = { userId: 't1', name: 'Alice', role: 'primary' as const };
    const g1: StudentGroupRef = { ...GROUP_A, teachers: [teacher] };
    const g2: StudentGroupRef = { ...GROUP_B, teachers: [teacher] };
    const result = studentTeachers([g1, g2]);
    expect(result).toHaveLength(1);
    expect(result[0]?.userId).toBe('t1');
  });

  it('orders primary before co-primary before substitute', () => {
    const primary = { userId: 't1', name: 'Alice', role: 'primary' as const };
    const substitute = { userId: 't2', name: 'Bob', role: 'substitute' as const };
    const coPrimary = { userId: 't3', name: 'Carol', role: 'co-primary' as const };
    const g: StudentGroupRef = { ...GROUP_A, teachers: [substitute, coPrimary, primary] };
    const result = studentTeachers([g]);
    expect(result.map((t) => t.role)).toEqual(['primary', 'co-primary', 'substitute']);
  });
});

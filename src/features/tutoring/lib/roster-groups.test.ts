// @vitest-environment node

import { describe, it, expect } from 'vitest';

import { splitRosterByGroup } from './roster-groups';
import type { StudentListItem, StudentGroupRef } from '@/features/students/types';

const HOME: StudentGroupRef = {
  id: 'home',
  name: "Tutor's workspace",
  lang: 'nb',
  level: 'A1',
  isDefault: true,
};

const TUESDAY: StudentGroupRef = { id: 'tue', name: 'Tuesday 19:00', lang: 'nb', level: 'A2' };
const MONDAY: StudentGroupRef = { id: 'mon', name: 'Monday 08:00', lang: 'nb', level: 'B1' };

function learner(userId: string, groups: StudentGroupRef[]): StudentListItem {
  return {
    userId,
    name: userId,
    email: `${userId}@example.com`,
    avatarUrl: null,
    lang: 'nb',
    level: 'A2',
    status: 'active',
    groups,
    progress: 0.5,
    lastSeen: null,
    enrolledAt: '2026-09-01',
  };
}

describe('splitRosterByGroup', () => {
  it('never draws the group everybody is in', () => {
    const { groups, solo } = splitRosterByGroup([learner('ola', [HOME])]);

    expect(groups).toEqual([]);
    expect(solo.map((s) => s.userId)).toEqual(['ola']);
  });

  it('groups learners by their real groups, sorted by name', () => {
    const { groups, solo } = splitRosterByGroup([
      learner('anna', [HOME, TUESDAY]),
      learner('per', [HOME]),
      learner('ivan', [HOME, TUESDAY]),
      learner('kari', [HOME, MONDAY]),
    ]);

    expect(groups.map((g) => g.name)).toEqual(['Monday 08:00', 'Tuesday 19:00']);
    expect(groups.map((g) => g.students.map((s) => s.userId))).toEqual([
      ['kari'],
      ['anna', 'ivan'],
    ]);
    expect(solo.map((s) => s.userId)).toEqual(['per']);
  });

  it('lists a learner under each group they are in, and not among the solo ones', () => {
    const { groups, solo } = splitRosterByGroup([learner('anna', [HOME, TUESDAY, MONDAY])]);

    expect(groups.map((g) => g.students.map((s) => s.userId))).toEqual([['anna'], ['anna']]);
    expect(solo).toEqual([]);
  });

  it('treats a group without the flag as a real one — a school roster has no home group', () => {
    const { groups, solo } = splitRosterByGroup([learner('anna', [TUESDAY])]);

    expect(groups).toHaveLength(1);
    expect(solo).toEqual([]);
  });
});

// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { suggestGroups } from './suggest-groups';
import type { Membership } from '@/features/enrollment/types';
import type { Group } from '@/features/groups/types';

function makeGroup(overrides: Partial<Group>): Group {
  return {
    id: 'g1', name: 'Group 1', courseId: null, materials: [],
    lang: 'nb', level: 'B1', status: 'active', mode: 'online',
    capacity: { min: 2, max: 8 }, studentCount: 3,
    startDate: null, endDate: null, teachers: [], slots: [],
    ...overrides,
  };
}

function makeMembership(overrides: Partial<Membership> = {}): Membership {
  return {
    id: 'm1', schoolSlug: 'school', schoolName: 'School',
    status: 'placement-review', source: 'invite',
    language: 'nb', createdAt: '2026-06-01',
    ...overrides,
  };
}

describe('suggestGroups', () => {
  it('returns only groups matching membership language', () => {
    const groups = [
      makeGroup({ id: 'g-nb', lang: 'nb', level: 'B1' }),
      makeGroup({ id: 'g-en', lang: 'en', level: 'B1' }),
    ];
    const membership = makeMembership({ language: 'nb' });
    const result = suggestGroups(membership, groups);
    expect(result.map((r) => r.group.id)).toEqual(['g-nb']);
  });

  it('excludes groups more than 1 CEFR level away', () => {
    const groups = [
      makeGroup({ id: 'a1', level: 'A1' }),
      makeGroup({ id: 'a2', level: 'A2' }),
      makeGroup({ id: 'b1', level: 'B1' }),
      makeGroup({ id: 'b2', level: 'B2' }),
    ];
    const membership = makeMembership({
      placement: { language: 'nb', cefrLevel: 'B1', score: 55, takenAt: '2026-01-01', scope: 'membership', sourceLabel: 'school' },
    });
    const result = suggestGroups(membership, groups);
    const ids = result.map((r) => r.group.id);
    expect(ids).toContain('a2');
    expect(ids).toContain('b1');
    expect(ids).toContain('b2');
    expect(ids).not.toContain('a1');
  });

  it('puts exact-level match first', () => {
    const groups = [
      makeGroup({ id: 'a2', level: 'A2' }),
      makeGroup({ id: 'b1', level: 'B1' }),
    ];
    const membership = makeMembership({
      placement: { language: 'nb', cefrLevel: 'B1', score: 55, takenAt: '2026-01-01', scope: 'membership', sourceLabel: 'school' },
    });
    const result = suggestGroups(membership, groups);
    expect(result[0]).toBeDefined();
    expect(result[0]!.group.id).toBe('b1');
    expect(result[0]!.levelDelta).toBe(0);
  });

  it('prefers groups with slot overlap', () => {
    const slot = { day: 'Mon' as const, start: '09:00', end: '10:00', room: '' };
    const groups = [
      makeGroup({ id: 'with-slot', level: 'B1', slots: [slot] }),
      makeGroup({ id: 'no-slot', level: 'B1', slots: [] }),
    ];
    const membership = makeMembership({
      placement: { language: 'nb', cefrLevel: 'B1', score: 55, takenAt: '2026-01-01', scope: 'membership', sourceLabel: 'school' },
      availability: [{ day: 'Mon', from: '08:00', to: '12:00' }],
    });
    const result = suggestGroups(membership, groups);
    expect(result[0]).toBeDefined();
    expect(result[0]!.group.id).toBe('with-slot');
    expect(result[0]!.slotOverlap).toBe(1);
  });

  it('excludes inactive groups', () => {
    const groups = [
      makeGroup({ id: 'draft', status: 'draft', level: 'B1' }),
      makeGroup({ id: 'active', status: 'active', level: 'B1' }),
    ];
    const membership = makeMembership();
    const result = suggestGroups(membership, groups);
    expect(result.map((r) => r.group.id)).toEqual(['active']);
  });

  it('marks hasCapacity correctly', () => {
    const groups = [
      makeGroup({ id: 'full', level: 'B1', capacity: { min: 2, max: 5 }, studentCount: 5 }),
      makeGroup({ id: 'open', level: 'B1', capacity: { min: 2, max: 5 }, studentCount: 3 }),
    ];
    const membership = makeMembership();
    const result = suggestGroups(membership, groups);
    const full = result.find((r) => r.group.id === 'full');
    const open = result.find((r) => r.group.id === 'open');
    expect(full).toBeDefined();
    expect(open).toBeDefined();
    expect(full!.hasCapacity).toBe(false);
    expect(open!.hasCapacity).toBe(true);
  });
});

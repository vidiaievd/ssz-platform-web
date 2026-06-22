// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

vi.mock('@/lib/api/server-fetcher', () => ({
  serverFetch: vi.fn(),
}));

// queries.ts uses 'server-only' — stub it
vi.mock('server-only', () => ({}));

const { mockSchoolTimetable, mockTeacherWeek } = vi.hoisted(() => ({
  mockSchoolTimetable: vi.fn(),
  mockTeacherWeek: vi.fn(),
}));

vi.mock('@/lib/scheduling/provider', () => ({
  getSchedulingProvider: () => ({
    getSlots: vi.fn().mockResolvedValue([]),
    schoolTimetable: mockSchoolTimetable,
    teacherWeek: mockTeacherWeek,
  }),
}));

const { serverFetch } = await import('@/lib/api/server-fetcher');
const mockFetch = vi.mocked(serverFetch);

const { getGroup, getTimetable, getTeacherLoads, getTeacherSchedule } = await import('./queries');

// organization-service's group entity uses capacityMin/capacityMax (not
// minCapacity/maxCapacity) and a GroupMode enum of 'online' | 'in_person'
// (underscore, not hyphen) — the raw shape returned by the real API.
const RAW_GROUP = {
  id: 'g1',
  name: 'Norwegian A2',
  courseId: 'course-main',
  courseName: null,
  lang: 'nb',
  level: 'A2',
  status: 'ACTIVE',
  mode: 'in_person',
  capacityMin: 4,
  capacityMax: 15,
  studentCount: 3,
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-06-01T00:00:00.000Z',
  teachers: [],
  members: [],
  materials: [{ id: 'mat-1', courseId: 'course-extra', addedAt: '2026-01-01T00:00:00.000Z' }],
};

// organization-service has no concept of a course title — it only stores
// courseId; titles are resolved from content-service per id.
const COURSE_TITLES: Record<string, string> = {
  'course-main': 'Norwegian A2 — Grammar',
  'course-extra': 'Norwegian A2 — Vocabulary',
};

function mockOrgFetch() {
  mockFetch.mockImplementation((opts: { service: string; path: string }) => {
    if (opts.service === 'organization' && opts.path === '/schools/school-1/groups/g1') {
      return Promise.resolve(RAW_GROUP);
    }
    if (opts.service === 'organization' && opts.path === '/schools/school-1/groups') {
      return Promise.resolve([RAW_GROUP]);
    }
    if (opts.service === 'content') {
      const id = opts.path.split('/').pop() ?? '';
      const title = COURSE_TITLES[id];
      return title ? Promise.resolve({ title }) : Promise.reject(new Error('not found'));
    }
    // members (students/teachers) lookups
    return Promise.resolve([]);
  });
}

describe('getGroup', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps capacityMin/capacityMax (not minCapacity/maxCapacity) onto capacity.min/max', async () => {
    mockOrgFetch();

    const group = await getGroup('school-1', 'g1');

    expect(group?.capacity).toEqual({ min: 4, max: 15 });
  });

  it('maps the backend\'s "in_person" mode to the frontend\'s "in-person"', async () => {
    mockOrgFetch();

    const group = await getGroup('school-1', 'g1');

    expect(group?.mode).toBe('in-person');
  });

  it('truncates the backend\'s ISO datetime startDate/endDate to a bare date', async () => {
    mockOrgFetch();

    const group = await getGroup('school-1', 'g1');

    expect(group?.startDate).toBe('2026-01-01');
    expect(group?.endDate).toBe('2026-06-01');
  });

  it('resolves the main material\'s title from content-service (organization-service only knows courseId)', async () => {
    mockOrgFetch();

    const group = await getGroup('school-1', 'g1');

    expect(group?.courseName).toBe('Norwegian A2 — Grammar');
  });

  it('maps additional materials with their resolved titles', async () => {
    mockOrgFetch();

    const group = await getGroup('school-1', 'g1');

    expect(group?.materials).toEqual([
      { id: 'mat-1', courseId: 'course-extra', courseName: 'Norwegian A2 — Vocabulary' },
    ]);
  });

  it('degrades a material\'s name to null if content-service lookup fails, without failing the page', async () => {
    mockFetch.mockImplementation((opts: { service: string; path: string }) => {
      if (opts.service === 'organization' && opts.path === '/schools/school-1/groups/g1') {
        return Promise.resolve({ ...RAW_GROUP, courseId: 'deleted-course' });
      }
      if (opts.service === 'organization' && opts.path === '/schools/school-1/groups') {
        return Promise.resolve([RAW_GROUP]);
      }
      if (opts.service === 'content') return Promise.reject(new Error('not found'));
      return Promise.resolve([]);
    });

    const group = await getGroup('school-1', 'g1');

    expect(group?.courseId).toBe('deleted-course');
    expect(group?.courseName).toBeNull();
  });
});

describe('getTimetable / getTeacherLoads', () => {
  beforeEach(() => vi.clearAllMocks());

  const TEACHERS = [
    { userId: 't1', name: 'Anna', avatarUrl: null, role: 'TEACHER', maxWeeklyHours: 10, langs: ['nb'] },
    { userId: 't2', name: 'Bjorn', avatarUrl: null, role: 'TEACHER', maxWeeklyHours: 20, langs: ['nb'] },
  ];

  const GROUPS = [
    { id: 'g1', name: 'Norwegian A2', lang: 'nb', teachers: [{ userId: 't1', role: 'PRIMARY' }] },
    { id: 'g2', name: 'Norwegian B1', lang: 'nb', teachers: [{ userId: 't2', role: 'PRIMARY' }] },
  ];

  function mockSchoolFetch() {
    mockFetch.mockImplementation((opts: { service: string; path: string }) => {
      if (opts.service === 'organization' && opts.path === '/schools/school-2/members') {
        return Promise.resolve(TEACHERS);
      }
      if (opts.service === 'organization' && opts.path === '/schools/school-2/groups') {
        return Promise.resolve(GROUPS);
      }
      return Promise.resolve([]);
    });
  }

  it('joins raw schedule entries with teacher and group data, computing hours/pct', async () => {
    mockSchoolFetch();
    mockSchoolTimetable.mockResolvedValue([
      { teacherId: 't1', day: 'Mon', start: '09:00', end: '10:00', groupId: 'g1', room: null },
    ]);

    const result = await getTimetable('school-2');
    if (!('data' in result)) throw new Error('expected data');
    const anna = result.data.find((t) => t.userId === 't1');

    expect(anna).toBeDefined();
    expect(anna!.lessons).toEqual([
      { day: 'Mon', start: '09:00', end: '10:00', groupId: 'g1', groupName: 'Norwegian A2', lang: 'nb', isSubstitute: false },
    ]);
    expect(anna!.hours).toBe(1);
    expect(anna!.max).toBe(10);
    expect(anna!.pct).toBe(10);
    expect(anna!.overloaded).toBe(false);
    expect(anna!.groups).toBe(1);
  });

  it('includes teachers with no lessons (full roster, not just scheduled ones)', async () => {
    mockSchoolFetch();
    mockSchoolTimetable.mockResolvedValue([]);

    const result = await getTimetable('school-2');
    if (!('data' in result)) throw new Error('expected data');

    expect(result.data.map((t) => t.userId).sort()).toEqual(['t1', 't2']);
    expect(result.data.every((t) => t.lessons.length === 0)).toBe(true);
  });

  it('marks a lesson as isSubstitute when the teaching teacher is not the group\'s assigned primary/co-primary', async () => {
    mockSchoolFetch();
    mockSchoolTimetable.mockResolvedValue([
      { teacherId: 't2', day: 'Mon', start: '09:00', end: '10:00', groupId: 'g1', room: null },
    ]);

    const result = await getTimetable('school-2');
    if (!('data' in result)) throw new Error('expected data');
    const bjorn = result.data.find((t) => t.userId === 't2');

    expect(bjorn!.lessons[0]!.isSubstitute).toBe(true);
  });

  it('counts overlapping lessons for the same teacher as conflicts', async () => {
    mockSchoolFetch();
    mockSchoolTimetable.mockResolvedValue([
      { teacherId: 't1', day: 'Mon', start: '09:00', end: '10:00', groupId: 'g1', room: null },
      { teacherId: 't1', day: 'Mon', start: '09:30', end: '10:30', groupId: 'g2', room: null },
    ]);

    const result = await getTimetable('school-2');
    if (!('data' in result)) throw new Error('expected data');
    const anna = result.data.find((t) => t.userId === 't1');

    expect(anna!.conflicts).toBe(1);
  });

  it('getTeacherLoads mirrors the same composed hours/max/pct per teacher', async () => {
    mockSchoolFetch();
    mockSchoolTimetable.mockResolvedValue([
      { teacherId: 't1', day: 'Mon', start: '09:00', end: '10:00', groupId: 'g1', room: null },
    ]);

    const loads = await getTeacherLoads('school-2');

    expect(loads['t1']).toEqual({ hours: 1, max: 10, pct: 10, overloaded: false, groups: 1, conflicts: 0 });
    expect(loads['t2']).toEqual({ hours: 0, max: 20, pct: 0, overloaded: false, groups: 0, conflicts: 0 });
  });
});

describe('getTeacherSchedule', () => {
  beforeEach(() => vi.clearAllMocks());

  const TEACHERS = [
    { userId: 't1', name: 'Anna', avatarUrl: null, role: 'TEACHER', maxWeeklyHours: 10, langs: ['nb'] },
  ];

  const GROUPS = [
    { id: 'g1', name: 'Norwegian A2', lang: 'nb', teachers: [{ userId: 't1', role: 'PRIMARY' }] },
  ];

  function mockSchoolFetch() {
    mockFetch.mockImplementation((opts: { service: string; path: string }) => {
      if (opts.service === 'organization' && opts.path === '/schools/school-3/members') {
        return Promise.resolve(TEACHERS);
      }
      if (opts.service === 'organization' && opts.path === '/schools/school-3/groups') {
        return Promise.resolve(GROUPS);
      }
      return Promise.resolve([]);
    });
  }

  it('composes a single teacher\'s own week from one teacherWeek call', async () => {
    mockSchoolFetch();
    mockTeacherWeek.mockResolvedValue([
      { day: 'Mon', start: '09:00', end: '10:00', groupId: 'g1', room: null },
    ]);

    const result = await getTeacherSchedule('school-3', 't1');

    expect(mockTeacherWeek).toHaveBeenCalledWith('school-3', 't1');
    if (!('data' in result) || !result.data) throw new Error('expected data');
    expect(result.data.userId).toBe('t1');
    expect(result.data.lessons).toEqual([
      { day: 'Mon', start: '09:00', end: '10:00', groupId: 'g1', groupName: 'Norwegian A2', lang: 'nb', isSubstitute: false },
    ]);
    expect(result.data.hours).toBe(1);
  });

  it('returns data: null when the teacher is not found in the school roster', async () => {
    mockSchoolFetch();
    mockTeacherWeek.mockResolvedValue([]);

    const result = await getTeacherSchedule('school-3', 'unknown-teacher');

    expect(result).toEqual({ data: null });
  });

  it('degrades to data: null when scheduling-service is unavailable', async () => {
    mockSchoolFetch();
    mockTeacherWeek.mockRejectedValue(new AppError('upstream_unavailable', 'down'));

    const result = await getTeacherSchedule('school-3', 't1');

    expect(result).toEqual({ data: null });
  });
});

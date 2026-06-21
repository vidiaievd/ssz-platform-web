// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({
  serverFetch: vi.fn(),
}));

// queries.ts uses 'server-only' — stub it
vi.mock('server-only', () => ({}));

vi.mock('@/lib/scheduling/provider', () => ({
  getSchedulingProvider: () => ({ getSlots: vi.fn().mockResolvedValue([]) }),
}));

const { serverFetch } = await import('@/lib/api/server-fetcher');
const mockFetch = vi.mocked(serverFetch);

const { getGroup } = await import('./queries');

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

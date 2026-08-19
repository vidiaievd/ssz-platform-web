// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));
vi.mock('@/features/auth/api/get-current-user', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/features/school/api/get-my-schools', () => ({ getMySchools: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getMySchools } from '@/features/school/api/get-my-schools';

const SCHOOL_ID = '11111111-1111-4111-8111-111111111111';

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

function upstream(
  overrides: {
    scope?: { groupIds: string[]; containerIds: string[] };
    count?: { pending: number; oldestSubmittedAt: string | null };
    schoolSla?: number | null;
    courseSla?: Record<string, { respondWithinHours: number | null; overridden: boolean }>;
  } = {},
) {
  const scope = overrides.scope ?? { groupIds: ['group-1'], containerIds: ['course-1'] };

  vi.mocked(serverFetch).mockImplementation(async (opts: { path: string }) => {
    if (opts.path === '/internal/review/scope') return scope;
    if (opts.path === '/internal/attempts/review/queue/count') {
      return overrides.count ?? { pending: 3, oldestSubmittedAt: hoursAgo(30) };
    }
    if (opts.path.startsWith('/schools')) {
      // `??` would swallow a deliberate null — the case where no promise was ever made.
      return { respondWithinHours: 'schoolSla' in overrides ? overrides.schoolSla : 48 };
    }
    const courseId = opts.path.split('/')[2] ?? '';
    return overrides.courseSla?.[courseId] ?? { respondWithinHours: null, overridden: false };
  });
}

const request = (query = `?school=${SCHOOL_ID}`) =>
  new NextRequest(`http://localhost/api/review/queue/count${query}`);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({ roles: ['tutor'], userId: 'teacher-1' });
  vi.mocked(getMySchools).mockResolvedValue([
    { id: SCHOOL_ID, name: 'Oslo skole', slug: 'oslo-skole', myRole: 'TEACHER' },
  ] as never);
});

describe('GET /api/review/queue/count', () => {
  it('refuses a school the caller is not a member of', async () => {
    vi.mocked(getMySchools).mockResolvedValue([]);
    expect((await GET(request())).status).toBe(403);
  });

  it('counts nothing for a teacher with no groups', async () => {
    upstream({ scope: { groupIds: [], containerIds: [] } });
    const body = await (await GET(request())).json();
    expect(body).toEqual({ pending: 0, hasOverdue: false });
  });

  it('reports the count without a dot while the oldest is inside every promise', async () => {
    upstream({ count: { pending: 3, oldestSubmittedAt: hoursAgo(10) }, schoolSla: 48 });
    const body = await (await GET(request())).json();
    expect(body).toEqual({ pending: 3, hasOverdue: false });
  });

  it('raises the dot once the oldest is past the shortest promise in play', async () => {
    upstream({
      count: { pending: 3, oldestSubmittedAt: hoursAgo(30) },
      schoolSla: 48,
      courseSla: { 'course-1': { respondWithinHours: 24, overridden: true } },
    });
    const body = await (await GET(request())).json();
    expect(body).toEqual({ pending: 3, hasOverdue: true });
  });

  it('never claims lateness against a promise nobody made', async () => {
    upstream({ count: { pending: 2, oldestSubmittedAt: hoursAgo(500) }, schoolSla: null });
    const body = await (await GET(request())).json();
    expect(body).toEqual({ pending: 2, hasOverdue: false });
  });

  it('skips the promise lookups entirely when nothing is waiting', async () => {
    upstream({ count: { pending: 0, oldestSubmittedAt: null } });
    const body = await (await GET(request())).json();

    expect(body).toEqual({ pending: 0, hasOverdue: false });
    expect(vi.mocked(serverFetch).mock.calls.map(([o]) => o.path)).toEqual([
      '/internal/review/scope',
      '/internal/attempts/review/queue/count',
    ]);
  });
});

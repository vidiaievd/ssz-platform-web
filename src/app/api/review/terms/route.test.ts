// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The journal is read only where analytics is configured.
vi.hoisted(() => {
  process.env.ANALYTICS_SERVICE_INTERNAL_URL = 'http://analytics.test';
  process.env.INTERNAL_SERVICE_TOKEN = 'internal-test-token';
});

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));
vi.mock('@/features/auth/api/get-current-user', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/features/school/api/get-my-schools', () => ({ getMySchools: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getMySchools } from '@/features/school/api/get-my-schools';

const SCHOOL_ID = '11111111-1111-4111-8111-111111111111';

const LINE = {
  from: '2026-10-19',
  to: '2026-10-25',
  teacherId: 'teacher-1',
  accepted: 4,
  revised: 1,
  overturned: 1,
};

function upstream(line: typeof LINE | Error = LINE) {
  vi.mocked(serverFetch).mockImplementation(async (opts: { path: string }) => {
    if (opts.path === '/internal/review/scope') return { groupIds: ['group-1'], containerIds: [] };
    if (line instanceof Error) throw line;
    return line;
  });
}

const request = (query = `?school=oslo-skole`) =>
  new NextRequest(`http://localhost/api/review/terms${query}`);

const analyticsCall = () =>
  vi
    .mocked(serverFetch)
    .mock.calls.map(([opts]) => opts as { path: string; query?: Record<string, string> })
    .find((opts) => opts.path.startsWith('/internal/review-terms'));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({ roles: ['tutor'], userId: 'teacher-1' });
  vi.mocked(getMySchools).mockResolvedValue([
    { id: SCHOOL_ID, name: 'Oslo skole', slug: 'oslo-skole', myRole: 'TEACHER' },
  ] as never);
});

describe('GET /api/review/terms', () => {
  it('asks for a school', async () => {
    expect((await GET(request(''))).status).toBe(400);
  });

  it('refuses a school the caller is not a member of', async () => {
    vi.mocked(getMySchools).mockResolvedValue([]);
    expect((await GET(request())).status).toBe(403);
    expect(analyticsCall()).toBeUndefined();
  });

  it("reads the caller's own line, by the school's id, over today and the six days before", async () => {
    upstream();
    const body = await (await GET(request())).json();

    expect(body).toEqual({ accepted: 4, revised: 1, overturned: 1, from: LINE.from, to: LINE.to });

    const call = analyticsCall()!;
    expect(call.path).toBe(`/internal/review-terms/schools/${SCHOOL_ID}/teachers/teacher-1`);
    const days = (Date.parse(call.query!.to!) - Date.parse(call.query!.from!)) / 86_400_000;
    expect(days).toBe(6);
  });

  it('never takes the teacher from the address bar', async () => {
    upstream();
    await GET(request('?school=oslo-skole&teacherId=someone-else'));
    expect(analyticsCall()!.path).toContain('/teachers/teacher-1');
  });

  it('answers null rather than a zero when the journal cannot be read', async () => {
    upstream(new Error('503'));
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });
});

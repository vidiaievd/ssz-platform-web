// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));
vi.mock('@/lib/api/profile-directory', () => ({ fetchProfileSummaries: vi.fn() }));
vi.mock('@/features/auth/api/get-current-user', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/features/school/api/get-my-schools', () => ({ getMySchools: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { fetchProfileSummaries } from '@/lib/api/profile-directory';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getMySchools } from '@/features/school/api/get-my-schools';

const SCHOOL_ID = '11111111-1111-4111-8111-111111111111';
const TEACHER = 'teacher-1';

/** Submitted 30 hours ago — late against a 24 h promise, fresh against 48 h. */
const SUBMITTED_AT = new Date(Date.now() - 30 * 3_600_000).toISOString();

const ENGINE_QUEUE = {
  summary: { pending: 1, oldestSubmittedAt: SUBMITTED_AT },
  groups: [
    {
      key: 'ex-1',
      kind: 'exercise',
      exerciseId: 'ex-1',
      containerId: 'course-1',
      path: { course: 'Ny i Norge A2', module: 'Leksjon 7', exercise: 'Perfektum' },
      count: 1,
      submittedAt: [SUBMITTED_AT],
      autoCleanIds: [],
      items: [
        {
          attemptId: 'att-1',
          userId: 'student-1',
          exerciseId: 'ex-1',
          templateCode: 'short_answer',
          groupId: 'group-1',
          containerId: 'course-1',
          path: { course: 'Ny i Norge A2', module: 'Leksjon 7', exercise: 'Perfektum' },
          submittedAt: SUBMITTED_AT,
          attemptNo: 1,
          autoClean: false,
          lock: null,
        },
      ],
    },
  ],
  nextCursor: null,
};

/**
 * Routes every upstream call by path, because the handler fans several of them out in
 * parallel and their order is not part of its contract.
 */
function upstream(
  overrides: {
    scope?: { groupIds: string[]; containerIds: string[] };
    queue?: unknown;
    schoolSla?: number | null;
    courseSla?: { respondWithinHours: number | null; overridden: boolean };
    groups?: { id: string; name: string }[];
  } = {},
) {
  const scope = overrides.scope ?? { groupIds: ['group-1'], containerIds: ['course-1'] };

  vi.mocked(serverFetch).mockImplementation(async (opts: { path: string }) => {
    if (opts.path === '/internal/review/scope') return scope;
    if (opts.path === '/internal/attempts/review/queue') return overrides.queue ?? ENGINE_QUEUE;
    if (opts.path.endsWith('/review-settings') && opts.path.startsWith('/schools')) {
      // `??` would swallow a deliberate null — the case where no promise was made.
      return { respondWithinHours: 'schoolSla' in overrides ? overrides.schoolSla : 48 };
    }
    if (opts.path.endsWith('/review-settings')) {
      return overrides.courseSla ?? { respondWithinHours: null, overridden: false };
    }
    if (opts.path.endsWith('/groups')) {
      return overrides.groups ?? [{ id: 'group-1', name: 'A2 kveld · tirsdag' }];
    }
    if (/^\/containers\/[^/]+$/.test(opts.path)) return { title: 'Ny i Norge A2' };
    throw new Error(`unexpected upstream call: ${opts.path}`);
  });
}

function request(query = `?school=${SCHOOL_ID}`): NextRequest {
  return new NextRequest(`http://localhost/api/review/queue${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({ roles: ['tutor'], userId: TEACHER });
  vi.mocked(getMySchools).mockResolvedValue([
    { id: SCHOOL_ID, name: 'Oslo skole', slug: 'oslo-skole', myRole: 'TEACHER' },
  ] as never);
  vi.mocked(fetchProfileSummaries).mockResolvedValue({
    'student-1': { userId: 'student-1', displayName: 'Anna Kowalska' },
  });
});

describe('GET /api/review/queue', () => {
  it('refuses a school the caller is not a member of', async () => {
    vi.mocked(getMySchools).mockResolvedValue([]);
    const response = await GET(request());
    expect(response.status).toBe(403);
  });

  it('never asks the engine about a school the caller was refused', async () => {
    vi.mocked(getMySchools).mockResolvedValue([]);
    await GET(request());
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it('gives a teacher with no groups an empty queue, not a refusal', async () => {
    upstream({ scope: { groupIds: [], containerIds: [] } });
    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.groups).toEqual([]);
    expect(body.summary.pending).toBe(0);
    // The engine is never troubled about an empty scope — only the filter options are
    // still fetched, so the screen can say what it could have shown.
    expect(vi.mocked(serverFetch).mock.calls.map(([o]) => o.path)).not.toContain(
      '/internal/attempts/review/queue',
    );
  });

  it("sends only the teacher's groups as scope, never their courses", async () => {
    upstream();
    await GET(request());

    const call = vi
      .mocked(serverFetch)
      .mock.calls.find(([o]) => o.path === '/internal/attempts/review/queue');
    expect(call?.[0].body).toMatchObject({ schoolId: SCHOOL_ID, groupIds: ['group-1'] });
    expect(call?.[0].body).not.toHaveProperty('containerIds');
  });

  it('narrows to a single group when the filter names one the teacher holds', async () => {
    upstream({ scope: { groupIds: ['group-1', 'group-2'], containerIds: [] } });
    await GET(request(`?school=${SCHOOL_ID}&group=group-2`));

    const call = vi
      .mocked(serverFetch)
      .mock.calls.find(([o]) => o.path === '/internal/attempts/review/queue');
    expect(call?.[0].body).toMatchObject({ groupIds: ['group-2'] });
  });

  it('empties the queue when the filter names a group the teacher does not hold', async () => {
    upstream();
    const response = await GET(request(`?school=${SCHOOL_ID}&group=someone-elses-group`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.groups).toEqual([]);
  });

  it("colours against the school's promise when the course has not overridden it", async () => {
    upstream({ schoolSla: 48 });
    const body = await (await GET(request())).json();

    expect(body.groups[0].slaHours).toBe(48);
    expect(body.groups[0].items[0].overdue).toBe(false);
  });

  it("lets a course's own promise beat the school's", async () => {
    upstream({ schoolSla: 48, courseSla: { respondWithinHours: 24, overridden: true } });
    const body = await (await GET(request())).json();

    expect(body.groups[0].slaHours).toBe(24);
    expect(body.groups[0].items[0].overdue).toBe(true);
    expect(body.summary.overdue).toBe(1);
  });

  it('joins in the learner name and the group name the row reads under', async () => {
    upstream();
    const body = await (await GET(request())).json();

    expect(body.groups[0].items[0].student).toMatchObject({
      name: 'Anna Kowalska',
      groupName: 'A2 kveld · tirsdag',
    });
  });

  it('opens the row under its id when the directory cannot name the learner', async () => {
    upstream();
    vi.mocked(fetchProfileSummaries).mockResolvedValue({});
    const body = await (await GET(request())).json();

    expect(body.groups[0].items[0].student.name).toBeNull();
    expect(body.groups[0].items[0].id).toBe('att-1');
  });

  it('drops rows inside their promise when asked for the late ones only', async () => {
    upstream({ schoolSla: 48 });
    const body = await (await GET(request(`?school=${SCHOOL_ID}&overdue=true`))).json();

    expect(body.groups).toEqual([]);
    // The summary still reports the whole scope, not what survived the filter.
    expect(body.summary.pending).toBe(1);
  });

  it('marks the overdue count partial while a cursor is still open', async () => {
    upstream({ queue: { ...ENGINE_QUEUE, nextCursor: 'next-page' } });
    const body = await (await GET(request())).json();

    expect(body.summary.overduePartial).toBe(true);
    expect(body.nextCursor).toBe('next-page');
  });

  it('offers the whole scope as filter options, not what survived the filters', async () => {
    upstream({ scope: { groupIds: ['group-1'], containerIds: ['course-1'] } });
    const body = await (await GET(request(`?school=${SCHOOL_ID}&course=course-1`))).json();

    expect(body.facets.groups).toEqual([{ id: 'group-1', name: 'A2 kveld · tirsdag' }]);
    expect(body.facets.courses).toEqual([{ id: 'course-1', name: 'Ny i Norge A2' }]);
  });

  it('still offers the options when a filter has emptied the queue', async () => {
    upstream();
    const body = await (await GET(request(`?school=${SCHOOL_ID}&group=not-mine`))).json();

    expect(body.groups).toEqual([]);
    expect(body.facets.groups).toHaveLength(1);
  });

  it('answers 400 without a school rather than guessing one', async () => {
    const response = await GET(request(''));
    expect(response.status).toBe(400);
  });
});

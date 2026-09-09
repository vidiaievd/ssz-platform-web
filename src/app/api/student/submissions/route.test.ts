// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));
vi.mock('@/features/auth/api/get-current-user', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/lib/api/profile-directory', () => ({ fetchProfileSummaries: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { fetchProfileSummaries } from '@/lib/api/profile-directory';

const LEARNER = 'student-1';
const SCHOOL = 'school-1';

const PENDING = {
  attemptId: 'att-1',
  exerciseId: 'ex-1',
  exercisePath: { course: 'Ny i Norge — A2', module: 'Leksjon 19', exercise: 'Familien' },
  containerId: 'course-1',
  schoolId: SCHOOL,
  submittedAt: '2026-08-19T09:00:00.000Z',
  status: 'pending',
  attemptNo: 1,
  decision: null,
  canResubmit: false,
};

const RETURNED = {
  ...PENDING,
  attemptId: 'att-2',
  status: 'returned',
  attemptNo: 2,
  decision: {
    verdict: 'returned',
    byUserId: 'teacher-1',
    at: '2026-08-19T11:00:00.000Z',
    comment: 'Se på perfektum.',
  },
  canResubmit: true,
};

function upstream(
  overrides: {
    items?: unknown[];
    nextCursor?: string | null;
    schoolSla?: number | null;
    courseSla?: { respondWithinHours: number | null; overridden: boolean };
    engineFails?: boolean;
  } = {},
) {
  vi.mocked(serverFetch).mockImplementation(async (opts: { path: string }) => {
    if (opts.path === '/internal/attempts/review/mine') {
      if (overrides.engineFails) throw new Error('nope');
      return {
        items: overrides.items ?? [PENDING],
        nextCursor: overrides.nextCursor ?? null,
      };
    }
    if (opts.path.startsWith('/schools')) {
      // `??` would swallow a deliberate null — a school that promised nothing.
      return { respondWithinHours: 'schoolSla' in overrides ? overrides.schoolSla : 48 };
    }
    return overrides.courseSla ?? { respondWithinHours: null, overridden: false };
  });
}

/** Every key anywhere in the response, however deep. */
function keysOf(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const entry of value) keysOf(entry, found);
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, entry] of Object.entries(value)) {
      found.push(key);
      keysOf(entry, found);
    }
  }
  return found;
}

const request = (query = '') =>
  new NextRequest(`http://localhost/api/student/submissions${query}`);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({ roles: ['student'], userId: LEARNER });
  vi.mocked(fetchProfileSummaries).mockResolvedValue({
    'teacher-1': { userId: 'teacher-1', displayName: 'Kari Nordmann' },
  });
});

describe('GET /api/student/submissions', () => {
  it('refuses a caller with no session', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    upstream();

    expect((await GET(request())).status).toBe(401);
  });

  /** The engine authorises nothing, so the id it is handed must be the session's. */
  it('asks the engine about the signed-in learner, never about an id from the query', async () => {
    upstream();

    await GET(request('?userId=someone-else'));

    expect(vi.mocked(serverFetch).mock.calls[0]![0]).toMatchObject({
      path: '/internal/attempts/review/mine',
      query: expect.objectContaining({ userId: LEARNER }),
    });
  });

  it('reads the exercise, course and lesson off the snapshot taken when the work started', async () => {
    upstream();

    const body = await (await GET(request())).json();

    expect(body.items[0]).toMatchObject({
      id: 'att-1',
      exerciseTitle: 'Familien',
      course: 'Ny i Norge — A2',
      lesson: 'Leksjon 19',
      status: 'pending',
    });
  });

  it('dates the answer a waiting submission is owed, from the promise behind it', async () => {
    upstream({ schoolSla: 48 });

    const body = await (await GET(request())).json();

    expect(body.items[0].expectedResponseBy).toBe('2026-08-21T09:00:00.000Z');
  });

  it('lets the course override the school it belongs to', async () => {
    upstream({ schoolSla: 48, courseSla: { respondWithinHours: 24, overridden: true } });

    const body = await (await GET(request())).json();

    expect(body.items[0].expectedResponseBy).toBe('2026-08-20T09:00:00.000Z');
  });

  /** A date nobody agreed to is worse than none: invariant 2 asks for a promise, not a guess. */
  it('leaves the date empty where no promise was ever made', async () => {
    upstream({ schoolSla: null });

    const body = await (await GET(request())).json();

    expect(body.items[0].expectedResponseBy).toBeNull();
  });

  it('puts no date on work that has already been answered', async () => {
    upstream({ items: [RETURNED] });

    const body = await (await GET(request())).json();

    expect(body.items[0].expectedResponseBy).toBeNull();
  });

  it('signs the verdict with the teacher’s name', async () => {
    upstream({ items: [RETURNED] });

    const body = await (await GET(request())).json();

    expect(body.items[0].decision).toEqual({
      verdict: 'returned',
      teacherId: 'teacher-1',
      teacherName: 'Kari Nordmann',
      at: '2026-08-19T11:00:00.000Z',
      comment: 'Se på perfektum.',
    });
  });

  it('still shows the verdict when the directory cannot name who gave it', async () => {
    vi.mocked(fetchProfileSummaries).mockResolvedValue({});
    upstream({ items: [RETURNED] });

    const body = await (await GET(request())).json();

    expect(body.items[0].decision).toMatchObject({ teacherName: null, verdict: 'returned' });
  });

  it('counts what is waiting and what came back, and says when that is only this page', async () => {
    upstream({ items: [PENDING, RETURNED], nextCursor: 'next' });

    const body = await (await GET(request())).json();

    expect(body.summary).toEqual({ pending: 1, returned: 1, partial: true });
    expect(body.nextCursor).toBe('next');
  });

  /** A page of one tab knows nothing about the others; a subtitle drawn from it would lie. */
  it('offers no counts on a filtered list', async () => {
    upstream({ items: [RETURNED] });

    const body = await (await GET(request('?status=returned'))).json();

    expect(body.summary).toBeNull();
    expect(vi.mocked(serverFetch).mock.calls[0]![0]).toMatchObject({
      query: expect.objectContaining({ status: 'returned' }),
    });
  });

  it('falls back to the whole list when asked for a status that is not one', async () => {
    upstream();

    await GET(request('?status=whatever'));

    expect(vi.mocked(serverFetch).mock.calls[0]![0]).toMatchObject({
      query: expect.objectContaining({ status: 'all' }),
    });
  });

  it('answers 502 rather than an empty list when the engine cannot be reached', async () => {
    upstream({ engineFails: true });

    expect((await GET(request())).status).toBe(502);
  });

  /**
   * Invariant 1, checked over the whole body rather than field by field: the answer key,
   * the validator's breakdown and unreleased per-item notes have no way into this
   * response, and this is what says so if one is ever added upstream.
   */
  it('carries nothing a learner must not see, however the engine grows', async () => {
    upstream({
      items: [
        {
          ...RETURNED,
          submittedAnswer: { answers: [{ itemId: 'i1', text: 'the actual answer' }] },
          validationDetails: { reference: 'do not leak me', diff: ['tokens'] },
          reviewDecisions: [{ itemId: 'i1', approved: false, comment: 'unreleased note' }],
        },
      ],
    });

    const body = await (await GET(request())).json();

    const payload = JSON.stringify(body);
    expect(payload).not.toContain('the actual answer');
    expect(payload).not.toContain('do not leak me');
    expect(payload).not.toContain('unreleased note');
    // By key as well as by value, because a field that arrived empty today is a field
    // that will arrive full tomorrow. Names, not substrings: `expectedResponseBy` is the
    // learner's own due date and has every right to be here.
    for (const forbidden of [
      'expected',
      'note',
      'rules',
      'diff',
      'ref',
      'tokens',
      'submittedAnswer',
      'validationDetails',
      'reviewDecisions',
    ]) {
      expect(keysOf(body)).not.toContain(forbidden);
    }
  });
});

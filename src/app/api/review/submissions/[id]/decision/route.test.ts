// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));
vi.mock('@/lib/api/profile-directory', () => ({ fetchProfileSummaries: vi.fn() }));
vi.mock('@/features/auth/api/get-current-user', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/features/school/api/get-my-schools', () => ({ getMySchools: vi.fn() }));
vi.mock('@/features/review/lib/sla-map', () => ({ buildSlaMap: vi.fn() }));

const { POST } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { fetchProfileSummaries } from '@/lib/api/profile-directory';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getMySchools } from '@/features/school/api/get-my-schools';
import { buildSlaMap } from '@/features/review/lib/sla-map';
import { AppError } from '@/lib/errors';

const SCHOOL_ID = '11111111-1111-4111-8111-111111111111';
const TEACHER = 'teacher-1';
const ATTEMPT = 'att-2';

const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString();
const SUBMITTED_AT = hoursAgo(30);

/** The queue as the engine serves it: oldest first, grouped. */
const QUEUE = {
  groups: [
    {
      items: [
        { attemptId: 'att-1', containerId: 'course-1', submittedAt: hoursAgo(50) },
        { attemptId: 'att-3', containerId: 'course-1', submittedAt: hoursAgo(10) },
        { attemptId: 'att-4', containerId: 'course-1', submittedAt: hoursAgo(2) },
      ],
    },
  ],
};

function upstream(
  overrides: {
    scopeNow?: string[];
    scopeThen?: string[];
    verdictFails?: AppError;
    queue?: typeof QUEUE;
  } = {},
) {
  const now = overrides.scopeNow ?? ['group-1'];
  const then = overrides.scopeThen ?? now;

  vi.mocked(serverFetch).mockImplementation(
    async (opts: { path: string; method?: string; query?: unknown }) => {
      if (opts.path === '/internal/review/scope') {
        const at = (opts.query as { at: string }).at;
        return { groupIds: at === SUBMITTED_AT ? then : now, containerIds: ['course-1'] };
      }
      if (opts.path === `/internal/attempts/${ATTEMPT}/review` && opts.method === undefined) {
        return {
          attemptId: ATTEMPT,
          groupId: 'group-1',
          containerId: 'course-1',
          submittedAt: SUBMITTED_AT,
        };
      }
      if (opts.path === `/internal/attempts/${ATTEMPT}/review` && opts.method === 'POST') {
        if (overrides.verdictFails) throw overrides.verdictFails;
        return { attemptId: ATTEMPT, status: 'SCORED', score: 3 };
      }
      if (opts.path === '/internal/attempts/review/queue') {
        return overrides.queue ?? QUEUE;
      }
      throw new Error(`unexpected upstream call: ${opts.path}`);
    },
  );
}

const context = { params: Promise.resolve({ id: ATTEMPT }) };

const request = (body: unknown) =>
  new NextRequest(
    `http://localhost/api/review/submissions/${ATTEMPT}/decision?school=${SCHOOL_ID}`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );

const approve = (extra: Record<string, unknown> = {}) =>
  request({ verdict: 'approved', comment: null, sentenceComments: {}, ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({ roles: ['tutor'], userId: TEACHER });
  vi.mocked(getMySchools).mockResolvedValue([
    { id: SCHOOL_ID, name: 'Oslo skole', slug: 'oslo-skole', myRole: 'TEACHER' },
  ] as never);
  vi.mocked(fetchProfileSummaries).mockResolvedValue({});
  vi.mocked(buildSlaMap).mockResolvedValue({ slaFor: () => 24 } as never);
});

describe('POST /api/review/submissions/[id]/decision', () => {
  it('records the verdict without a score in either direction (criterion 19)', async () => {
    upstream();
    const response = await POST(approve(), context);

    expect(response.status).toBe(200);
    const sent = vi
      .mocked(serverFetch)
      .mock.calls.find(([opts]) => opts.method === 'POST' && opts.path.endsWith(`/review`))?.[0];
    expect(sent?.body).toEqual({
      reviewerId: TEACHER,
      outcome: 'approved',
      comment: null,
      sentenceComments: {},
    });
    expect(JSON.stringify(sent?.body)).not.toContain('score');
  });

  it('forwards rubric marks unread — the engine holds the weights and the threshold', async () => {
    upstream();
    const response = await POST(
      request({ verdict: 'approved', rubricMarks: { 'c-task': 3, 'c-lang': 2 } }),
      context,
    );

    expect(response.status).toBe(200);
    const sent = vi
      .mocked(serverFetch)
      .mock.calls.find(([opts]) => opts.method === 'POST' && opts.path.endsWith(`/review`))?.[0];
    expect(sent?.body).toMatchObject({ rubricMarks: { 'c-task': 3, 'c-lang': 2 } });
    // Judgements travel; a score never does, on this template or any other.
    expect(JSON.stringify(sent?.body)).not.toContain('score');
  });

  it('sends no rubric field at all when the screen had no rubric', async () => {
    upstream();
    await POST(approve(), context);

    const sent = vi
      .mocked(serverFetch)
      .mock.calls.find(([opts]) => opts.method === 'POST' && opts.path.endsWith(`/review`))?.[0];
    expect(sent?.body).not.toHaveProperty('rubricMarks');
  });

  // The screen keeps the action disabled until the rubric is whole, so this is two tabs
  // or a stale one — and it has to name which criteria are blank rather than say the
  // verdict failed for reasons of its own.
  it('passes an incomplete rubric back with the criteria that are still blank', async () => {
    upstream({
      verdictFails: new AppError('validation', 'Upstream 422', {
        code: 'RUBRIC_INCOMPLETE',
        missing: ['c-lang'],
      }),
    });

    const response = await POST(
      request({ verdict: 'approved', rubricMarks: { 'c-task': 3 } }),
      context,
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ code: 'RUBRIC_INCOMPLETE', missing: ['c-lang'] });
  });

  it('hands back the next submission in the queue, not the top of it', async () => {
    upstream();
    // att-1 is older than the one just decided; att-3 is the one that follows it.
    expect((await (await POST(approve(), context)).json()).nextId).toBe('att-3');
  });

  it('goes back to the top when the decided one was the newest — work is still waiting', async () => {
    upstream({
      queue: {
        groups: [{ items: [{ attemptId: 'att-1', containerId: 'c', submittedAt: hoursAgo(50) }] }],
      },
    });

    expect((await (await POST(approve(), context)).json()).nextId).toBe('att-1');
  });

  it('answers null only when the queue is actually empty (criterion 16)', async () => {
    upstream({ queue: { groups: [] } });

    expect((await (await POST(approve(), context)).json()).nextId).toBeNull();
  });

  it('names the colleague who got there first (criterion 24)', async () => {
    upstream({
      verdictFails: new AppError('conflict', 'Upstream 409', {
        code: 'ALREADY_REVIEWED',
        by: 'teacher-9',
        verdict: 'returned',
        at: '2026-08-19T09:00:00.000Z',
      }),
    });
    vi.mocked(fetchProfileSummaries).mockResolvedValue({
      'teacher-9': { userId: 'teacher-9', displayName: 'Marius Berg' },
    });

    const response = await POST(approve(), context);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ byName: 'Marius Berg', verdict: 'returned' });
  });

  it('passes a return with no comment back as a code, for the field to show (criterion 18)', async () => {
    upstream({
      verdictFails: new AppError('validation', 'Upstream 422', {
        code: 'RETURN_REQUIRES_COMMENT',
      }),
    });

    const response = await POST(request({ verdict: 'returned', comment: '' }), context);

    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe('RETURN_REQUIRES_COMMENT');
  });

  it('refuses the verdict once the assignment has run out, with a reason', async () => {
    upstream({ scopeNow: [], scopeThen: ['group-1'] });
    const response = await POST(approve(), context);

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('window_expired');
    expect(vi.mocked(serverFetch).mock.calls.some(([opts]) => opts.method === 'POST')).toBe(false);
  });

  it('refuses a school the caller is not a member of', async () => {
    upstream();
    vi.mocked(getMySchools).mockResolvedValue([]);

    expect((await POST(approve(), context)).status).toBe(403);
  });

  it('narrows the successor to what is overdue when the queue was filtered that way', async () => {
    upstream();
    // Only the 50-hour-old one is past a 24-hour promise; the two younger rows are not.
    const response = await POST(
      approve({ filters: { groupBy: 'exercise', overdueOnly: true } }),
      context,
    );

    expect((await response.json()).nextId).toBe('att-1');
  });
});

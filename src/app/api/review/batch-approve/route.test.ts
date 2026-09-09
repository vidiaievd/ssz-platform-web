// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));
vi.mock('@/features/auth/api/get-current-user', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/features/school/api/get-my-schools', () => ({ getMySchools: vi.fn() }));

const { POST } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getMySchools } from '@/features/school/api/get-my-schools';

const SCHOOL_ID = '11111111-1111-4111-8111-111111111111';
const TEACHER = 'teacher-1';

/** What the caller's own queue holds — the whole of what they may batch. */
const MINE = ['att-1', 'att-2', 'att-3'];

function upstream(
  overrides: {
    queue?: string[][];
    approved?: number;
    skipped?: { id: string; reason: string }[];
    batchFails?: boolean;
    groups?: string[];
  } = {},
) {
  const pages = overrides.queue ?? [MINE];
  let page = 0;

  vi.mocked(serverFetch).mockImplementation(async (opts: { path: string; body?: unknown }) => {
    if (opts.path === '/internal/review/scope') {
      return { groupIds: overrides.groups ?? ['group-1'], containerIds: [] };
    }
    if (opts.path === '/internal/attempts/review/queue') {
      const ids = pages[page] ?? [];
      page += 1;
      return {
        groups: [{ items: ids.map((attemptId) => ({ attemptId })) }],
        nextCursor: page < pages.length ? `cursor-${page}` : null,
      };
    }
    if (opts.path === '/internal/attempts/review/batch-approve') {
      if (overrides.batchFails) throw new Error('502');
      const sent = (opts.body as { attemptIds: string[] }).attemptIds;
      return {
        approved: overrides.approved ?? sent.length,
        skipped: overrides.skipped ?? [],
      };
    }
    throw new Error(`unexpected upstream call: ${opts.path}`);
  });
}

const request = (attemptIds: unknown) =>
  new NextRequest(`http://localhost/api/review/batch-approve?school=${SCHOOL_ID}`, {
    method: 'POST',
    body: JSON.stringify({ attemptIds }),
  });

const sentToEngine = () =>
  (
    vi
      .mocked(serverFetch)
      .mock.calls.find(([opts]) => opts.path === '/internal/attempts/review/batch-approve')?.[0]
      .body as { attemptIds: string[] } | undefined
  )?.attemptIds;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({ roles: ['tutor'], userId: TEACHER });
  vi.mocked(getMySchools).mockResolvedValue([
    { id: SCHOOL_ID, name: 'Oslo skole', slug: 'oslo-skole', myRole: 'TEACHER' },
  ] as never);
});

describe('POST /api/review/batch-approve', () => {
  it('approves the named list under the caller’s own name', async () => {
    upstream();
    const response = await POST(request(['att-1', 'att-2']));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ approved: 2, skipped: [] });
    expect(sentToEngine()).toEqual(['att-1', 'att-2']);
  });

  it('sends nothing it did not find in the caller’s queue', async () => {
    upstream();
    // `att-9` belongs to a group this teacher does not hold.
    const body = await (await POST(request(['att-1', 'att-9']))).json();

    expect(sentToEngine()).toEqual(['att-1']);
    expect(body.skipped).toContainEqual({ id: 'att-9', reason: 'not_found' });
  });

  it('reports a partial success as a success, with the reasons beside it', async () => {
    upstream({ approved: 1, skipped: [{ id: 'att-2', reason: 'already_reviewed' }] });
    const response = await POST(request(['att-1', 'att-2']));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      approved: 1,
      skipped: [{ id: 'att-2', reason: 'already_reviewed' }],
    });
  });

  it('does not call the engine at all when nothing was the caller’s', async () => {
    upstream();
    const body = await (await POST(request(['att-8', 'att-9']))).json();

    expect(sentToEngine()).toBeUndefined();
    expect(body).toEqual({
      approved: 0,
      skipped: [
        { id: 'att-8', reason: 'not_found' },
        { id: 'att-9', reason: 'not_found' },
      ],
    });
  });

  it('keeps looking through the queue until every id is accounted for', async () => {
    upstream({ queue: [['att-1'], ['att-2']] });

    await POST(request(['att-1', 'att-2']));

    expect(sentToEngine()).toEqual(['att-1', 'att-2']);
  });

  it('approves nothing for a teacher with no groups', async () => {
    upstream({ groups: [] });
    const body = await (await POST(request(['att-1']))).json();

    expect(sentToEngine()).toBeUndefined();
    expect(body.approved).toBe(0);
  });

  it('refuses a school the caller is not a member of', async () => {
    upstream();
    vi.mocked(getMySchools).mockResolvedValue([]);

    expect((await POST(request(['att-1']))).status).toBe(403);
  });

  it('refuses a list longer than one a teacher could have read', async () => {
    upstream();
    const many = Array.from({ length: 101 }, (_, n) => `att-${n}`);

    expect((await POST(request(many))).status).toBe(422);
  });

  it('refuses an empty list rather than inventing one', async () => {
    upstream();

    expect((await POST(request([]))).status).toBe(400);
  });
});

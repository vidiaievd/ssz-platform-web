// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));
vi.mock('@/lib/api/profile-directory', () => ({ fetchProfileSummaries: vi.fn() }));
vi.mock('@/features/auth/api/get-current-user', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/features/school/api/get-my-schools', () => ({ getMySchools: vi.fn() }));

const { DELETE, POST } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { fetchProfileSummaries } from '@/lib/api/profile-directory';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getMySchools } from '@/features/school/api/get-my-schools';

const SCHOOL_ID = '11111111-1111-4111-8111-111111111111';
const TEACHER = 'teacher-1';
const ATTEMPT = 'att-1';
const SUBMITTED_AT = new Date(Date.now() - 3 * 3_600_000).toISOString();
const IN_15_MIN = new Date(Date.now() + 15 * 60_000).toISOString();

function upstream(
  overrides: {
    scopeNow?: string[];
    scopeThen?: string[];
    lock?: { teacherId: string; expiresAt: string } | null;
    lockFails?: boolean;
  } = {},
) {
  const now = overrides.scopeNow ?? ['group-1'];
  const then = overrides.scopeThen ?? now;

  vi.mocked(serverFetch).mockImplementation(async (opts: { path: string; query?: unknown }) => {
    if (opts.path === '/internal/review/scope') {
      const at = (opts.query as { at: string }).at;
      return { groupIds: at === SUBMITTED_AT ? then : now, containerIds: [] };
    }
    if (opts.path === `/internal/attempts/${ATTEMPT}/review`) {
      return { groupId: 'group-1', submittedAt: SUBMITTED_AT };
    }
    if (opts.path === `/internal/attempts/${ATTEMPT}/review/lock`) {
      if (overrides.lockFails) throw new Error('422');
      // `??` would swallow a deliberate null — the release case, where nobody holds it.
      return {
        lock: 'lock' in overrides ? overrides.lock : { teacherId: TEACHER, expiresAt: IN_15_MIN },
      };
    }
    throw new Error(`unexpected upstream call: ${opts.path}`);
  });
}

const context = { params: Promise.resolve({ id: ATTEMPT }) };
const request = () =>
  new NextRequest(`http://localhost/api/review/submissions/${ATTEMPT}/lock?school=${SCHOOL_ID}`);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({ roles: ['tutor'], userId: TEACHER });
  vi.mocked(getMySchools).mockResolvedValue([
    { id: SCHOOL_ID, name: 'Oslo skole', slug: 'oslo-skole', myRole: 'TEACHER' },
  ] as never);
  vi.mocked(fetchProfileSummaries).mockResolvedValue({});
});

describe('POST /api/review/submissions/[id]/lock', () => {
  it('marks the submission for the caller and says the marker is theirs', async () => {
    upstream();
    const body = await (await POST(request(), context)).json();

    expect(body.mine).toBe(true);
    expect(body.lock.expiresAt).toBe(IN_15_MIN);
  });

  it('answers with a colleague’s marker rather than taking it from them', async () => {
    upstream({ lock: { teacherId: 'teacher-9', expiresAt: IN_15_MIN } });
    vi.mocked(fetchProfileSummaries).mockResolvedValue({
      'teacher-9': { userId: 'teacher-9', displayName: 'Marius Berg' },
    });

    const body = await (await POST(request(), context)).json();

    expect(body.mine).toBe(false);
    expect(body.lock.teacherName).toBe('Marius Berg');
  });

  it('refuses the marker once the assignment has run out, with a reason', async () => {
    upstream({ scopeNow: [], scopeThen: ['group-1'] });
    const response = await POST(request(), context);

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('window_expired');
  });

  it('never fails the screen over a submission that cannot be marked', async () => {
    // Already decided, or never routed to a person: the engine refuses, the screen goes on.
    upstream({ lockFails: true });
    const response = await POST(request(), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ lock: null, mine: false });
  });
});

describe('DELETE /api/review/submissions/[id]/lock', () => {
  it('releases the marker on the way out', async () => {
    upstream({ lock: null });
    const body = await (await DELETE(request(), context)).json();

    expect(body).toEqual({ lock: null, mine: false });
  });
});

// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';

const PARAMS = { params: Promise.resolve({ id: 'course-1' }) };

const RAW_ENTRY = {
  id: 'entry-1',
  entityType: 'EXERCISE' as const,
  entityId: 'exercise-1',
  entityTitle: 'Gap-Fill',
  action: 'updated',
  actorUserId: 'user-1',
  changedFields: ['content'],
  occurredAt: '2026-08-07T09:00:00.000Z',
};

const PROFILE = { userId: 'user-1', displayName: 'Dmytro V.' };

function request(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/content/containers/course-1/activity${query}`);
}

/**
 * The handler calls content first, then the directory. Queueing the answers in
 * that order keeps the mocks to the `…Once` style used across these route tests.
 */
function upstream(activity: unknown, profiles: unknown = [PROFILE]) {
  vi.mocked(serverFetch).mockResolvedValueOnce(activity).mockResolvedValueOnce(profiles);
}

function profileCalls() {
  return vi
    .mocked(serverFetch)
    .mock.calls.filter(([args]) => (args as { service: string }).service === 'profile');
}

describe('GET /api/content/containers/[id]/activity', () => {
  beforeEach(() => vi.mocked(serverFetch).mockReset());

  it('names the actor behind each entry', async () => {
    upstream({ entries: [RAW_ENTRY], hasMore: false });

    const response = await GET(request(), PARAMS);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.entries[0].actor).toEqual(PROFILE);
    expect(body.hasMore).toBe(false);
  });

  it('asks the directory once for a page with repeated actors', async () => {
    upstream({ entries: [RAW_ENTRY, { ...RAW_ENTRY, id: 'entry-2' }], hasMore: false });

    await GET(request(), PARAMS);

    expect(profileCalls()).toHaveLength(1);
    expect(profileCalls()[0]?.[0]).toMatchObject({ query: { userIds: 'user-1' } });
  });

  it('still serves the history when the directory is down', async () => {
    // The history is what the author came for; losing it to a blinking user
    // directory would be the worse trade.
    vi.mocked(serverFetch)
      .mockResolvedValueOnce({ entries: [RAW_ENTRY], hasMore: false })
      .mockRejectedValueOnce(new Error('directory down'));

    const response = await GET(request(), PARAMS);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.entries[0].actor).toBeNull();
  });

  it('leaves the actor null when the directory has no profile for the id', async () => {
    upstream({ entries: [RAW_ENTRY], hasMore: false }, []);

    const body = await (await GET(request(), PARAMS)).json();

    expect(body.entries[0].actor).toBeNull();
  });

  it('passes the paging cursor through untouched', async () => {
    upstream({ entries: [RAW_ENTRY], hasMore: false });

    await GET(request('?limit=10&before=2026-08-07T08:00:00.000Z'), PARAMS);

    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/containers/course-1/activity',
        query: { limit: '10', before: '2026-08-07T08:00:00.000Z' },
      }),
    );
  });

  it('reports a bad gateway rather than an empty history', async () => {
    // An empty feed is a claim that nothing ever happened. On a failed upstream
    // call that claim is false, and the panel must be able to say so instead.
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('upstream down'));

    const response = await GET(request(), PARAMS);

    expect(response.status).toBe(502);
  });

  it('does not call the directory when there is nothing to name', async () => {
    upstream({ entries: [], hasMore: false });

    await GET(request(), PARAMS);

    expect(vi.mocked(serverFetch)).toHaveBeenCalledTimes(1);
  });
});

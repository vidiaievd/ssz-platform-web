// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import type { ContainerActivity } from '@/features/content-authoring/types';

const PARAMS = { params: Promise.resolve({ id: 'course-1' }) };

const MOCK_ACTIVITY: ContainerActivity = {
  entries: [
    {
      id: 'entry-1',
      entityType: 'EXERCISE',
      entityId: 'exercise-1',
      entityTitle: 'Gap-Fill',
      action: 'updated',
      actorUserId: 'user-1',
      changedFields: ['content'],
      occurredAt: '2026-08-07T09:00:00.000Z',
    },
  ],
  hasMore: false,
};

function request(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/content/containers/course-1/activity${query}`);
}

describe('GET /api/content/containers/[id]/activity', () => {
  beforeEach(() => vi.mocked(serverFetch).mockReset());

  it('returns the feed the service reports', async () => {
    vi.mocked(serverFetch).mockResolvedValue(MOCK_ACTIVITY);

    const response = await GET(request(), PARAMS);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(MOCK_ACTIVITY);
    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/containers/course-1/activity', query: {} }),
    );
  });

  it('passes the paging cursor through untouched', async () => {
    vi.mocked(serverFetch).mockResolvedValue(MOCK_ACTIVITY);

    await GET(request('?limit=10&before=2026-08-07T08:00:00.000Z'), PARAMS);

    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({
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
});

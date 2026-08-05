// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));
vi.mock('@/features/auth/api/get-current-user', () => ({ getCurrentUser: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { getCurrentUser } from '@/features/auth/api/get-current-user';

const CONTAINER = {
  id: 'course-1',
  title: 'Norsk B1',
  containerType: 'course',
  targetLanguage: 'nb',
  currentPublishedVersionId: 'version-1',
};

const LIST_RESPONSE = { items: [CONTAINER], total: 1, page: 1, limit: 25, totalPages: 1 };

/** Routes the two upstream calls the handler can make by path. */
function stubUpstream(
  summaries: unknown = [
    { containerId: 'course-1', publishState: 'published', pendingModuleCount: 2 },
  ],
) {
  vi.mocked(serverFetch).mockImplementation((async ({ path }: { path: string }) => {
    if (path === '/containers') return LIST_RESPONSE;
    if (path === '/internal/containers/publish-states') return summaries;
    throw new Error(`Unexpected path ${path}`);
  }) as never);
}

function request(url: string) {
  return new NextRequest(new URL(url, 'http://localhost'));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({ userId: 'user-1' } as never);
});

describe('GET /api/content/containers', () => {
  it('tells the author which of their courses are waiting to be released', async () => {
    // currentPublishedVersionId cannot express it: a course is "published" from
    // the first release onwards, and says nothing about a module inside it that
    // students still cannot open.
    stubUpstream();

    const res = await GET(request('/api/content/containers?scope=owned'));
    const body = await res.json();

    expect(body.items[0]).toMatchObject({ publishState: 'published', pendingModuleCount: 2 });
  });

  it('leaves the public catalogue unenriched', async () => {
    stubUpstream();

    const res = await GET(request('/api/content/containers?scope=public'));
    const body = await res.json();

    expect(body.items[0].publishState).toBeUndefined();
    expect(vi.mocked(serverFetch).mock.calls.map((c) => (c[0] as { path: string }).path)).toEqual([
      '/containers',
    ]);
  });

  it('still returns the list when publish states cannot be resolved', async () => {
    // The list is worth showing without the badge.
    vi.mocked(serverFetch).mockImplementation((async ({ path }: { path: string }) => {
      if (path === '/containers') return LIST_RESPONSE;
      throw new Error('content-service is down');
    }) as never);

    const res = await GET(request('/api/content/containers?scope=owned'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].publishState).toBeUndefined();
  });

  it('leaves a container the summary call skipped untouched', async () => {
    stubUpstream([]);

    const res = await GET(request('/api/content/containers?scope=owned'));
    const body = await res.json();

    expect(body.items[0].publishState).toBeUndefined();
  });
});

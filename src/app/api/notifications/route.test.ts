// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
  headers: async () => new Headers(),
}));

vi.mock('@/lib/api/server-fetcher', () => ({
  serverFetch: vi.fn(),
}));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';

function makeRequest(query: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/notifications');
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

beforeEach(() => {
  vi.mocked(serverFetch).mockReset();
});

describe('GET /api/notifications', () => {
  it('forwards filter/type/cursor/limit to the upstream service', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce({ items: [], unreadCount: 0, nextCursor: null });

    await GET(makeRequest({ filter: 'unread', type: 'ENROLLMENT_REQUEST', cursor: 'c1', limit: '20' }));

    const call = vi.mocked(serverFetch).mock.calls[0]![0] as { query?: Record<string, string> };
    expect(call.query).toEqual({
      cursor: 'c1',
      limit: '20',
      filter: 'unread',
      type: 'ENROLLMENT_REQUEST',
    });
  });

  it('returns 200 with the upstream payload', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce({ items: [], unreadCount: 2, nextCursor: null });

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [], unreadCount: 2, nextCursor: null });
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('unauthenticated', 'no token'));

    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
  });

  it('falls back to an empty list on other upstream errors', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('upstream down'));

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [], unreadCount: 0 });
  });
});

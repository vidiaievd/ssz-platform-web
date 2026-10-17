// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
  headers: async () => new Headers(),
}));

vi.mock('@/lib/api/server-fetcher', () => ({
  serverFetch: vi.fn(),
}));

const { GET, DELETE } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';

const request = new Request('http://localhost') as unknown as NextRequest;

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.mocked(serverFetch).mockReset();
});

describe('GET /api/media/assets/[id]', () => {
  it('returns the asset', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce({ id: 'a1', status: 'READY' });

    const res = await GET(request, params('a1'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'a1', status: 'READY' });
  });

  // Plan 76, 2.2: a gateway rate limit used to read as a broken media service (502).
  it.each([
    ['not_found', 404],
    ['unauthenticated', 401],
    ['forbidden', 403],
    ['rate_limited', 429],
    ['upstream_unavailable', 503],
  ] as const)('keeps the upstream refusal %s as %i', async (code, status) => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError(code, 'refused'));

    const res = await GET(request, params('a1'));

    expect(res.status).toBe(status);
  });

  it('returns 502 only for what it cannot name', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('socket hang up'));

    const res = await GET(request, params('a1'));

    expect(res.status).toBe(502);
  });
});

describe('DELETE /api/media/assets/[id]', () => {
  it('returns 204', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(undefined);

    const res = await DELETE(request, params('a1'));

    expect(res.status).toBe(204);
  });

  it('keeps a forbidden delete as 403', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('forbidden', 'not yours'));

    const res = await DELETE(request, params('a1'));

    expect(res.status).toBe(403);
  });
});

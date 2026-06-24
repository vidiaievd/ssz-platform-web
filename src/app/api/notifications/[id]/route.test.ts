// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
  headers: async () => new Headers(),
}));

vi.mock('@/lib/api/server-fetcher', () => ({
  serverFetch: vi.fn(),
}));

const { DELETE } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.mocked(serverFetch).mockReset();
});

describe('DELETE /api/notifications/[id]', () => {
  it('returns 204 and hits the delete endpoint', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(undefined);

    const res = await DELETE(new Request('http://localhost'), params('n1'));

    expect(res.status).toBe(204);
    const call = vi.mocked(serverFetch).mock.calls[0]![0] as { path: string; method: string };
    expect(call.path).toBe('/notifications/n1');
    expect(call.method).toBe('DELETE');
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('unauthenticated', 'no token'));

    const res = await DELETE(new Request('http://localhost'), params('n1'));

    expect(res.status).toBe(401);
  });

  it('returns 502 on other upstream errors', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('upstream down'));

    const res = await DELETE(new Request('http://localhost'), params('n1'));

    expect(res.status).toBe(502);
  });
});

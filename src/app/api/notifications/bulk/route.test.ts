// @vitest-environment node

import { NextRequest } from 'next/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
  headers: async () => new Headers(),
}));

vi.mock('@/lib/api/server-fetcher', () => ({
  serverFetch: vi.fn(),
}));

const { POST } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/notifications/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(serverFetch).mockReset();
});

describe('POST /api/notifications/bulk', () => {
  it('returns 204 and forwards ids/action to the upstream service', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(undefined);

    const res = await POST(makeRequest({ ids: ['n1', 'n2'], action: 'archive' }));

    expect(res.status).toBe(204);
    const call = vi.mocked(serverFetch).mock.calls[0]![0] as {
      path: string;
      method: string;
      body: unknown;
    };
    expect(call.path).toBe('/notifications/bulk');
    expect(call.method).toBe('POST');
    expect(call.body).toEqual({ ids: ['n1', 'n2'], action: 'archive' });
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('unauthenticated', 'no token'));

    const res = await POST(makeRequest({ ids: ['n1'], action: 'delete' }));

    expect(res.status).toBe(401);
  });

  it('returns 502 on other upstream errors', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('upstream down'));

    const res = await POST(makeRequest({ ids: ['n1'], action: 'read' }));

    expect(res.status).toBe(502);
  });
});

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
  return new NextRequest('http://localhost/api/learning/srs/card-states', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(serverFetch).mockReset();
});

describe('POST /api/learning/srs/card-states', () => {
  it('forwards contentType/contentIds to the upstream service', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce({
      states: [{ contentId: 'v1', state: 'REVIEW', stability: 25, dueAt: '2026-08-01T00:00:00Z' }],
    });

    const res = await POST(makeRequest({ contentType: 'VOCABULARY_WORD', contentIds: ['v1', 'v2'] }));

    expect(res.status).toBe(200);
    const call = vi.mocked(serverFetch).mock.calls[0]![0] as {
      path: string;
      method: string;
      body: unknown;
    };
    expect(call.path).toBe('/srs/cards/states');
    expect(call.method).toBe('POST');
    expect(call.body).toEqual({ contentType: 'VOCABULARY_WORD', contentIds: ['v1', 'v2'] });
    expect(await res.json()).toEqual({
      states: [{ contentId: 'v1', state: 'REVIEW', stability: 25, dueAt: '2026-08-01T00:00:00Z' }],
    });
  });

  it('returns 400 when contentType is missing', async () => {
    const res = await POST(makeRequest({ contentIds: ['v1'] }));
    expect(res.status).toBe(400);
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it('returns 400 when contentIds is not an array', async () => {
    const res = await POST(makeRequest({ contentType: 'VOCABULARY_WORD', contentIds: 'v1' }));
    expect(res.status).toBe(400);
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api/learning/srs/card-states', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('unauthenticated', 'no token'));

    const res = await POST(makeRequest({ contentType: 'VOCABULARY_WORD', contentIds: ['v1'] }));

    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('rate_limited', 'slow down'));

    const res = await POST(makeRequest({ contentType: 'VOCABULARY_WORD', contentIds: ['v1'] }));

    expect(res.status).toBe(429);
  });

  it('returns 502 on other upstream errors', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('upstream down'));

    const res = await POST(makeRequest({ contentType: 'VOCABULARY_WORD', contentIds: ['v1'] }));

    expect(res.status).toBe(502);
  });
});

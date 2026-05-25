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
const { serverFetch } = await import('@/lib/api/server-fetcher');
const mockServerFetch = vi.mocked(serverFetch);

function makeRequest(name: string) {
  return new NextRequest(`http://localhost/api/schools/name-available?name=${encodeURIComponent(name)}`);
}

describe('GET /api/schools/name-available', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns { available: null, suggestions: [] } and skips upstream when name is empty', async () => {
    const res = await GET(makeRequest(''));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ available: null, suggestions: [] });
    expect(mockServerFetch).not.toHaveBeenCalled();
  });

  it('returns { available: null, suggestions: [] } and skips upstream for a single-char name', async () => {
    const res = await GET(makeRequest('A'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ available: null, suggestions: [] });
    expect(mockServerFetch).not.toHaveBeenCalled();
  });

  it('returns available: true when name is free', async () => {
    mockServerFetch.mockResolvedValue({ available: true, suggestions: [] });

    const res = await GET(makeRequest('Unique School Name'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.available).toBe(true);
    expect(mockServerFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'organization',
        path: '/api/v1/schools/name-available',
        query: { name: 'Unique School Name' },
      }),
    );
  });

  it('returns available: false with suggestions when name is taken', async () => {
    mockServerFetch.mockResolvedValue({
      available: false,
      suggestions: ['Oslo School 2', 'Oslo School 3'],
    });

    const res = await GET(makeRequest('Oslo School'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.available).toBe(false);
    expect(body.suggestions).toEqual(['Oslo School 2', 'Oslo School 3']);
  });

  it('returns 502 on upstream error', async () => {
    const { AppError } = await import('@/lib/errors');
    mockServerFetch.mockRejectedValue(new AppError('upstream_unavailable', 'Service down'));

    const res = await GET(makeRequest('Some School'));

    expect(res.status).toBe(502);
  });

  it('returns 401 when unauthenticated', async () => {
    const { AppError } = await import('@/lib/errors');
    mockServerFetch.mockRejectedValue(new AppError('unauthenticated', 'No token'));

    const res = await GET(makeRequest('Some School'));

    expect(res.status).toBe(401);
  });
});

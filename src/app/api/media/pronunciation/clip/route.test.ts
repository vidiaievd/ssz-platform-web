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

const { POST } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';

function makeRequest(body: unknown | string) {
  return new NextRequest('http://localhost/api/media/pronunciation/clip', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.mocked(serverFetch).mockReset();
});

describe('POST /api/media/pronunciation/clip', () => {
  it('forwards the word and answers with the new asset', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce({
      assetId: 'a-1',
      voice: 'nb_NO-talesyntese-medium',
    });

    const res = await POST(makeRequest({ text: 'kjøre', lang: 'nb', exerciseId: 'ex-1' }));

    expect(vi.mocked(serverFetch).mock.calls[0]![0]).toMatchObject({
      service: 'media',
      path: '/media/pronunciation/clip',
      method: 'POST',
      body: { text: 'kjøre', lang: 'nb', exerciseId: 'ex-1' },
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ assetId: 'a-1', voice: 'nb_NO-talesyntese-medium' });
  });

  it('rejects a malformed body before calling the service', async () => {
    const res = await POST(makeRequest('not json'));

    expect(res.status).toBe(400);
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('unauthenticated', 'no token'));

    expect((await POST(makeRequest({ text: 'bil' }))).status).toBe(401);
  });

  it('maps a refused language or text to 422', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(
      new AppError('validation', 'LANGUAGE_NOT_SUPPORTED'),
    );

    expect((await POST(makeRequest({ text: 'car', lang: 'en' }))).status).toBe(422);
  });

  it('returns 502 when the media service is unreachable', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    expect((await POST(makeRequest({ text: 'bil' }))).status).toBe(502);
  });
});

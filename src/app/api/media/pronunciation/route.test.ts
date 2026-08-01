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
  return new NextRequest('http://localhost/api/media/pronunciation', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.mocked(serverFetch).mockReset();
});

describe('POST /api/media/pronunciation', () => {
  it('forwards the word to the media service and returns the clip URL', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce({ url: 'http://minio/tts/no/abc.mp3', cached: true });

    const res = await POST(makeRequest({ text: 'sykepleier', lang: 'nb' }));

    expect(vi.mocked(serverFetch).mock.calls[0]![0]).toMatchObject({
      service: 'media',
      path: '/media/pronunciation',
      method: 'POST',
      body: { text: 'sykepleier', lang: 'nb' },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'http://minio/tts/no/abc.mp3', cached: true });
  });

  it('rejects a malformed body before calling the service', async () => {
    const res = await POST(makeRequest('not json'));

    expect(res.status).toBe(400);
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('unauthenticated', 'no token'));

    const res = await POST(makeRequest({ text: 'bil' }));

    expect(res.status).toBe(401);
  });

  it('maps an upstream rejection of the text to 422', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('validation', 'TEXT_TOO_LONG'));

    const res = await POST(makeRequest({ text: 'x'.repeat(500) }));

    expect(res.status).toBe(422);
  });

  it('returns 502 when the media service is unreachable', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await POST(makeRequest({ text: 'bil' }));

    expect(res.status).toBe(502);
  });
});

// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { POST } = await import('./route');
const takes = await import('./[attemptId]/takes/route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

const post = (url: string, body: unknown) =>
  new NextRequest(`http://localhost${url}`, { method: 'POST', body: JSON.stringify(body) });

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('POST /api/sound-sessions', () => {
  it('starts a session for a language and, when chosen, a sound', async () => {
    vi.mocked(serverFetch).mockResolvedValue({ attemptId: 'a1' });
    const res = await POST(post('/api/sound-sessions', { language: 'nb', atomId: 'nb:kj' }));
    expect(res.status).toBe(200);
    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'exercises',
        path: '/sound-sessions',
        method: 'POST',
        body: { language: 'nb', atomId: 'nb:kj' },
      }),
    );
  });

  it('refuses a body without a language before calling anything', async () => {
    expect((await POST(post('/api/sound-sessions', {}))).status).toBe(400);
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it('keeps the engine’s code and retry time of a refusal, and drops its prose', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(
      new AppError('validation', 'x', { code: 'SESSION_LIMIT', retryAfterMs: 3000, message: 'prose' }),
    );
    const res = await POST(post('/api/sound-sessions', { language: 'nb' }));
    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toEqual({ error: 'Refused', code: 'SESSION_LIMIT', retryAfterMs: 3000 });
  });

  it('turns a missing payer answer into 503 and anything else into 502', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('upstream_unavailable', 'x', null));
    expect((await POST(post('/api/sound-sessions', { language: 'nb' }))).status).toBe(503);
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('boom'));
    expect((await POST(post('/api/sound-sessions', { language: 'nb' }))).status).toBe(502);
  });
});

describe('POST /api/sound-sessions/[attemptId]/takes', () => {
  const params = Promise.resolve({ attemptId: 'att-1' });

  it('tells a stale take apart and hands the current index back', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('conflict', 'x', { code: 'STALE_TAKE', takeIndex: 4 }));
    const res = await takes.POST(
      post('/api/sound-sessions/att-1/takes', { recordingAssetId: 'r1', takeIndex: 3 }),
      { params },
    );
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: 'Refused', code: 'STALE_TAKE', takeIndex: 4 });
  });

  it('wants the recording and the take index', async () => {
    const res = await takes.POST(post('/api/sound-sessions/att-1/takes', { recordingAssetId: 'r1' }), { params });
    expect(res.status).toBe(400);
  });
});

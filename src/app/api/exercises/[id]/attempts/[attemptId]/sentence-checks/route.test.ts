// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { POST } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

const BODY = { itemId: 'p1', sentence: 'Jeg liker kveld.', recordingAssetId: 'a1' };
const ANSWER = { attemptId: 'att-1', itemId: 'p1', status: 'ok', feedback: { summary: '', items: [] } };

const request = (body: unknown = BODY) =>
  new NextRequest('http://localhost/api/exercises/ex-1/attempts/att-1/sentence-checks', {
    method: 'POST',
    body: JSON.stringify(body),
  });
const params = Promise.resolve({ id: 'ex-1', attemptId: 'att-1' });

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('POST /api/exercises/[id]/attempts/[attemptId]/sentence-checks', () => {
  it('passes the sentence and the take up and hands the engine’s answer back', async () => {
    vi.mocked(serverFetch).mockResolvedValue(ANSWER);

    const res = await POST(request({ ...BODY, explanationLanguage: 'ru' }), { params });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(ANSWER);
    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'exercises',
        path: '/exercises/ex-1/attempts/att-1/sentence-checks',
        method: 'POST',
        body: { ...BODY, explanationLanguage: 'ru' },
      }),
    );
  });

  it('refuses a body without a sentence or a take before spending anything', async () => {
    expect((await POST(request({ itemId: 'p1' }), { params })).status).toBe(400);
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it.each([
    ['forbidden', 403],
    ['conflict', 409],
    ['not_found', 404],
    ['validation', 422],
    ['upstream_unavailable', 503],
    ['unauthenticated', 401],
  ] as const)('maps %s to %i', async (code, status) => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError(code, 'x'));
    expect((await POST(request(), { params })).status).toBe(status);
  });
});

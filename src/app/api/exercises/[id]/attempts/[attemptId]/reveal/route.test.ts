// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { POST } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

const REVEALED = {
  attemptId: 'att-1',
  answers: [
    { gapKey: 's1#3', label: 'G1', word: 'bestille', why: 'Etter «vil gjerne»…' },
    { gapKey: 's2#3', label: 'G2', word: 'regningen', why: null },
  ],
  attemptClosed: true,
};

const request = () =>
  new NextRequest('http://localhost/api/exercises/ex-1/attempts/att-1/reveal', { method: 'POST' });

const params = Promise.resolve({ id: 'ex-1', attemptId: 'att-1' });

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('POST /api/exercises/[id]/attempts/[attemptId]/reveal', () => {
  it('returns the answers, which no other route in this client does', async () => {
    vi.mocked(serverFetch).mockResolvedValue(REVEALED);

    const res = await POST(request(), { params });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(REVEALED);
  });

  it('sends no body — there is nothing to say beyond "show me"', async () => {
    vi.mocked(serverFetch).mockResolvedValue(REVEALED);
    await POST(request(), { params });

    expect(serverFetch).toHaveBeenCalledWith({
      service: 'exercises',
      path: '/exercises/ex-1/attempts/att-1/reveal',
      method: 'POST',
    });
  });

  it('maps the errors the caller can act on', async () => {
    const cases: Array<[string, number]> = [
      ['unauthenticated', 401],
      ['forbidden', 403],
      ['not_found', 404],
    ];
    for (const [code, status] of cases) {
      vi.mocked(serverFetch).mockRejectedValueOnce(new AppError(code as 'not_found', 'nope'));
      const res = await POST(request(), { params });
      expect(res.status).toBe(status);
    }
  });

  it('refuses rather than inventing answers when the engine will not give them', async () => {
    // 422 from the engine — nothing submitted yet, or a template that never hid its
    // answers. Either way the caller gets nothing, which is the safe failure.
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('Unprocessable'));
    const res = await POST(request(), { params });

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ error: 'Cannot show the answers yet' });
  });
});

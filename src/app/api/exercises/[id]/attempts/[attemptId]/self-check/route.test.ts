// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { POST } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

const FEEDBACK = {
  attemptId: 'att-1',
  checksUsed: 1,
  checksLeft: 1,
  fixedCount: 1,
  spanCount: 3,
  items: [
    { itemId: 'i1', fixedCount: 1, spanCount: 1, fixedSpans: [true], strayEdits: 0 },
    { itemId: 'i2', fixedCount: 0, spanCount: 2, fixedSpans: [false, false], strayEdits: 1 },
  ],
};

const DRAFT = { items: { i1: { marked: { 2: true }, fix: { 2: 'gikk' }, ins: {} } } };

const request = (body: unknown = { draftAnswer: DRAFT }) =>
  new NextRequest('http://localhost/api/exercises/ex-1/attempts/att-1/self-check', {
    method: 'POST',
    body: JSON.stringify(body),
  });

const params = Promise.resolve({ id: 'ex-1', attemptId: 'att-1' });

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('POST /api/exercises/[id]/attempts/[attemptId]/self-check', () => {
  it('passes the draft up and hands the counts back', async () => {
    vi.mocked(serverFetch).mockResolvedValue(FEEDBACK);

    const res = await POST(request(), { params });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(FEEDBACK);
    expect(serverFetch).toHaveBeenCalledWith({
      service: 'exercises',
      path: '/exercises/ex-1/attempts/att-1/self-check',
      method: 'POST',
      body: { draftAnswer: DRAFT },
    });
  });

  it('refuses a body without a draft rather than spending a check on nothing', async () => {
    const res = await POST(request({}), { params });

    expect(res.status).toBe(400);
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it('keeps "no self-check available" apart from a failure, so the runner can stop asking', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('validation', 'spent'));

    const res = await POST(request(), { params });

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toEqual({ error: 'No self-check available' });
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

  it('reports a broken upstream as a failure of its own', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('boom'));

    const res = await POST(request(), { params });

    expect(res.status).toBe(502);
  });
});

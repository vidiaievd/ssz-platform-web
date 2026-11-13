// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { POST } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

const ANSWER = {
  attemptId: 'att-1',
  templateCode: 'writing_task',
  selfCheck: null,
  ai: { status: 'ok' },
  feedback: { summary: 'Fine.', items: [], words: [] },
  reading: null,
  remaining: { exercise: 2, learnerChecksApprox: 6 },
};

const DRAFT = { text: 'Jeg bor i Oslo.', ticked: [] };

const request = (body: unknown = { draftAnswer: DRAFT }) =>
  new NextRequest('http://localhost/api/exercises/ex-1/attempts/att-1/check', {
    method: 'POST',
    body: JSON.stringify(body),
  });

const params = Promise.resolve({ id: 'ex-1', attemptId: 'att-1' });

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('POST /api/exercises/[id]/attempts/[attemptId]/check', () => {
  it('passes the draft up and hands the engine’s answer back, waiting as long as a model may take', async () => {
    vi.mocked(serverFetch).mockResolvedValue(ANSWER);

    const res = await POST(request(), { params });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(ANSWER);
    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'exercises',
        path: '/exercises/ex-1/attempts/att-1/check',
        method: 'POST',
        body: { draftAnswer: DRAFT },
        timeoutMs: 125_000,
      }),
    );
  });

  it('refuses a body without a draft rather than spending a check on nothing', async () => {
    const res = await POST(request({}), { params });

    expect(res.status).toBe(400);
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it('keeps the final refusals (school or plan, already handed in) apart from a fault', async () => {
    const cases: Array<[ConstructorParameters<typeof AppError>[0], number]> = [
      ['unauthenticated', 401],
      ['forbidden', 403],
      ['not_found', 404],
      ['conflict', 409],
      ['validation', 400],
      ['upstream_unavailable', 503],
    ];
    for (const [code, status] of cases) {
      vi.mocked(serverFetch).mockRejectedValueOnce(new AppError(code, 'x'));
      const res = await POST(request(), { params });
      expect(res.status, code).toBe(status);
    }
  });

  it('answers 502 for anything it does not recognise', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('boom'));

    const res = await POST(request(), { params });

    expect(res.status).toBe(502);
  });
});

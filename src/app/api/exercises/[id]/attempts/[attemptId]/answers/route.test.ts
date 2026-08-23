// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { POST } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

const ANSWERED = {
  attemptId: 'att-1',
  answered: 2,
  total: 4,
  result: {
    questionId: 'sa2',
    verdict: 'partial',
    covered: 1,
    total: 2,
    tooShort: false,
    hits: [
      { id: 'e1', label: 'Mer ansvar', required: true, hit: true },
      { id: 'e2', label: 'Høyere lønn', required: true, hit: false },
    ],
    why: 'Teksten nevner to ting han ønsker seg.',
  },
  routedForReview: true,
};

const request = (body: unknown = { questionId: 'sa2', text: 'Han vil ha mer ansvar.' }) =>
  new NextRequest('http://localhost/api/exercises/ex-1/attempts/att-1/answers', {
    method: 'POST',
    body: JSON.stringify(body),
  });

const params = Promise.resolve({ id: 'ex-1', attemptId: 'att-1' });

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('POST /api/exercises/[id]/attempts/[attemptId]/answers', () => {
  it('passes the answer up and hands the verdict back', async () => {
    vi.mocked(serverFetch).mockResolvedValue(ANSWERED);

    const res = await POST(request(), { params });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(ANSWERED);
    expect(serverFetch).toHaveBeenCalledWith({
      service: 'exercises',
      path: '/exercises/ex-1/attempts/att-1/answers',
      method: 'POST',
      body: { questionId: 'sa2', text: 'Han vil ha mer ansvar.' },
    });
  });

  it('refuses an empty answer before it becomes a fail nobody can revisit', async () => {
    const res = await POST(request({ questionId: 'sa2', text: '   ' }), { params });

    expect(res.status).toBe(400);
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it('refuses a body that names no question', async () => {
    const res = await POST(request({ text: 'Han vil ha mer ansvar.' }), { params });

    expect(res.status).toBe(400);
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it('keeps a refusal apart from a failure, so the runner stops offering the button', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('validation', 'already answered'));

    const res = await POST(request(), { params });

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toEqual({ error: 'This answer cannot be handed in' });
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

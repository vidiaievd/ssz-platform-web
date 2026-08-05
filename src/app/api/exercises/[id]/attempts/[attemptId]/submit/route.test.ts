// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { POST } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

const CHECKED = {
  attemptId: 'att-1',
  correct: false,
  score: 50,
  requiresReview: false,
  feedback: { summary: 'Nesten!' },
  details: {
    totalGaps: 2,
    correctGaps: 1,
    gaps: [
      { gapKey: 's1#3', correct: false, explanation: '«bestilt» needs «har».' },
      { gapKey: 's2#3', correct: true, explanation: null },
    ],
  },
};

const BODY = {
  submittedAnswer: { placements: [{ gapKey: 's1#3', word: 'bestilt' }] },
  timeSpentSeconds: 12,
};

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/exercises/ex-1/attempts/att-1/submit', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const params = Promise.resolve({ id: 'ex-1', attemptId: 'att-1' });

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('POST /api/exercises/[id]/attempts/[attemptId]/submit', () => {
  it('forwards the placements and returns the verdict', async () => {
    vi.mocked(serverFetch).mockResolvedValue(CHECKED);

    const res = await POST(makeRequest(BODY), { params });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(CHECKED);
    expect(serverFetch).toHaveBeenCalledWith({
      service: 'exercises',
      path: '/exercises/ex-1/attempts/att-1/submit',
      method: 'POST',
      body: BODY,
    });
  });

  it('returns explanations but no answers — being wrong hands nothing over', async () => {
    vi.mocked(serverFetch).mockResolvedValue(CHECKED);

    const res = await POST(makeRequest(BODY), { params });
    const payload = JSON.stringify(await res.json());

    expect(payload).toContain('«bestilt» needs «har».');
    expect(payload).not.toContain('bestille');
  });

  it('passes the locale on when one is given', async () => {
    vi.mocked(serverFetch).mockResolvedValue(CHECKED);
    await POST(makeRequest({ ...BODY, locale: 'nb' }), { params });

    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({ body: { ...BODY, locale: 'nb' } }),
    );
  });

  it('rejects a submission with no answer or no time', async () => {
    for (const body of [{ timeSpentSeconds: 1 }, { submittedAnswer: {} }]) {
      const res = await POST(makeRequest(body), { params });
      expect(res.status).toBe(400);
    }
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it('maps the errors the caller can act on', async () => {
    const cases: Array<[string, number]> = [
      ['unauthenticated', 401],
      ['forbidden', 403],
      ['not_found', 404],
    ];
    for (const [code, status] of cases) {
      vi.mocked(serverFetch).mockRejectedValueOnce(new AppError(code as 'not_found', 'nope'));
      const res = await POST(makeRequest(BODY), { params });
      expect(res.status).toBe(status);
    }
  });

  it('does not report a failed check as a wrong answer', async () => {
    // A 502 and "you got it wrong" are different things, and conflating them would
    // tell a learner they were wrong when the network was.
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('socket hang up'));
    const res = await POST(makeRequest(BODY), { params });
    expect(res.status).toBe(502);
  });
});

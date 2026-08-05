// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { POST } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

const STARTED = {
  attemptId: 'att-1',
  templateCode: 'word_bank_gap_fill',
  targetLanguage: 'no',
  difficultyLevel: 'B1',
  checkMode: 'PRACTICE',
  exerciseContent: { sentences: [], bank: [], settings: {} },
  expectedAnswers: null,
  answerSchema: {},
  checkSettings: {},
};

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/exercises/ex-1/attempts', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const params = Promise.resolve({ id: 'ex-1' });

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('POST /api/exercises/[id]/attempts', () => {
  it('starts the attempt and returns what the engine sent', async () => {
    vi.mocked(serverFetch).mockResolvedValue(STARTED);

    const res = await POST(makeRequest({ language: 'no' }), { params });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(STARTED);
    expect(serverFetch).toHaveBeenCalledWith({
      service: 'exercises',
      path: '/exercises/ex-1/attempts',
      method: 'POST',
      body: { language: 'no' },
    });
  });

  it('passes the mode on when the caller asked for one', async () => {
    vi.mocked(serverFetch).mockResolvedValue(STARTED);
    await POST(makeRequest({ language: 'no', mode: 'GRADED' }), { params });

    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({ body: { language: 'no', mode: 'GRADED' } }),
    );
  });

  it('rejects a request with no language rather than guessing one', async () => {
    const res = await POST(makeRequest({}), { params });

    expect(res.status).toBe(400);
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it('rejects a body that is not JSON', async () => {
    const res = await POST(makeRequest('not json'), { params });
    expect(res.status).toBe(400);
  });

  it('passes a conflict through, because resuming is the right answer to it', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(
      new AppError('conflict', 'Attempt already in progress: att-9'),
    );

    const res = await POST(makeRequest({ language: 'no' }), { params });

    expect(res.status).toBe(409);
    // The running attempt's id has to survive, or the caller cannot resume.
    await expect(res.json()).resolves.toEqual({ error: 'Attempt already in progress: att-9' });
  });

  it('maps the errors the caller can act on', async () => {
    const cases: Array<[string, number]> = [
      ['unauthenticated', 401],
      ['not_found', 404],
    ];
    for (const [code, status] of cases) {
      vi.mocked(serverFetch).mockRejectedValueOnce(new AppError(code as 'not_found', 'nope'));
      const res = await POST(makeRequest({ language: 'no' }), { params });
      expect(res.status).toBe(status);
    }
  });

  it('does not leak an upstream failure as a success', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('socket hang up'));
    const res = await POST(makeRequest({ language: 'no' }), { params });
    expect(res.status).toBe(502);
  });
});

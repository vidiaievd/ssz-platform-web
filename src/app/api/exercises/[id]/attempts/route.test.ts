// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET, POST } = await import('./route');
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

  it('clears an attempt left running and starts a fresh one', async () => {
    // Re-opening the exercise is the common case: the engine keeps an attempt
    // IN_PROGRESS until something is submitted, so a learner coming back conflicts
    // with themselves. Nothing is lost — the placements only ever lived in the browser.
    vi.mocked(serverFetch)
      .mockRejectedValueOnce(
        new AppError('conflict', 'Upstream 409', {
          message: 'Attempt already in progress',
          attemptId: 'att-9',
        }),
      )
      .mockResolvedValueOnce({ status: 'IN_PROGRESS' }) // GET the stale attempt: any draft?
      .mockResolvedValueOnce(undefined) // DELETE the stale attempt
      .mockResolvedValueOnce({ ...STARTED, attemptId: 'att-2' });

    const res = await POST(makeRequest({ language: 'no' }), { params });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ attemptId: 'att-2' });
    expect(serverFetch).toHaveBeenNthCalledWith(3, {
      service: 'exercises',
      path: '/exercises/ex-1/attempts/att-9',
      method: 'DELETE',
    });
    // Nothing was written: an attempt with no draft leaves the fresh one empty rather
    // than saving `null` over it.
    expect(serverFetch).toHaveBeenCalledTimes(4);
  });

  it('carries a saved draft onto the fresh attempt', async () => {
    // The reason this route may not simply throw the stale attempt away any more: it can
    // hold a `writing_task` draft, and that draft is the learner's text. Losing it on
    // re-opening the page would make the reload the one reliable way to lose an evening.
    const draft = { text: 'Hei Kari, jeg skriver fordi…', ticked: ['p1'] };
    vi.mocked(serverFetch)
      .mockRejectedValueOnce(new AppError('conflict', 'Upstream 409', { attemptId: 'att-9' }))
      .mockResolvedValueOnce({ status: 'IN_PROGRESS', draftAnswer: draft })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ ...STARTED, attemptId: 'att-2', templateCode: 'writing_task' })
      .mockResolvedValueOnce({ savedAt: '2026-08-22T09:00:00.000Z' });

    const res = await POST(makeRequest({ language: 'no' }), { params });

    expect(res.status).toBe(200);
    expect(serverFetch).toHaveBeenNthCalledWith(5, {
      service: 'exercises',
      path: '/exercises/ex-1/attempts/att-2/draft',
      method: 'PUT',
      body: { draftAnswer: draft },
    });
  });

  it('still hands over the fresh attempt when the draft could not be carried', async () => {
    // A lost draft is bad; an exercise that refuses to open because of it is worse, and
    // the text is still on the abandoned row either way.
    vi.mocked(serverFetch)
      .mockRejectedValueOnce(new AppError('conflict', 'Upstream 409', { attemptId: 'att-9' }))
      .mockResolvedValueOnce({ status: 'IN_PROGRESS', draftAnswer: { text: 'noe' } })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ ...STARTED, attemptId: 'att-2' })
      .mockRejectedValueOnce(new Error('draft save failed'));

    const res = await POST(makeRequest({ language: 'no' }), { params });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ attemptId: 'att-2' });
  });

  it('starts the fresh attempt even when the stale one cannot be read', async () => {
    vi.mocked(serverFetch)
      .mockRejectedValueOnce(new AppError('conflict', 'Upstream 409', { attemptId: 'att-9' }))
      .mockRejectedValueOnce(new Error('read failed'))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ ...STARTED, attemptId: 'att-2' });

    const res = await POST(makeRequest({ language: 'no' }), { params });

    expect(res.status).toBe(200);
  });

  it('reports the conflict when the stale attempt cannot be cleared', async () => {
    vi.mocked(serverFetch)
      .mockRejectedValueOnce(new AppError('conflict', 'Upstream 409', { attemptId: 'att-9' }))
      .mockResolvedValueOnce({ status: 'IN_PROGRESS' })
      .mockRejectedValueOnce(new Error('still there'));

    const res = await POST(makeRequest({ language: 'no' }), { params });

    expect(res.status).toBe(409);
    // The running attempt's id travels with the refusal: a caller holding an answer can
    // submit it into the attempt that is already open rather than being told to wait for
    // a state it cannot see or change (47.3).
    await expect(res.json()).resolves.toEqual({
      error: 'An attempt is already in progress',
      attemptId: 'att-9',
    });
  });

  it('reports the conflict when the engine names no attempt to clear', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('conflict', 'Upstream 409', null));

    const res = await POST(makeRequest({ language: 'no' }), { params });
    expect(res.status).toBe(409);
    // Nothing to carry on with: the attempt exists but this route cannot name it, and a
    // submit aimed at a guess would be worse than the refusal.
    await expect(res.json()).resolves.toEqual({ error: 'An attempt is already in progress' });
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

function makeGetRequest() {
  return new NextRequest('http://localhost/api/exercises/ex-1/attempts');
}

describe('GET /api/exercises/[id]/attempts', () => {
  const scored = {
    id: 'att-2',
    exerciseId: 'ex-1',
    templateCode: 'word_bank_gap_fill',
    status: 'SCORED',
    checkMode: 'PRACTICE',
    score: 100,
    passed: true,
    answersRevealed: false,
    submittedAnswer: { placements: [{ gapKey: 's1#3', word: 'bestille' }] },
    validationDetails: { totalGaps: 1, correctGaps: 1, gaps: [] },
    submittedAt: '2026-08-08T10:00:00.000Z',
    scoredAt: '2026-08-08T10:00:01.000Z',
  };

  it('returns the newest finished attempt', async () => {
    const older = { ...scored, id: 'att-1' };
    vi.mocked(serverFetch).mockResolvedValue({ items: [scored, older] });

    const res = await GET(makeGetRequest(), { params });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ attempt: scored });
    expect(serverFetch).toHaveBeenCalledWith({
      service: 'exercises',
      path: '/exercises/ex-1/attempts',
      method: 'GET',
      query: { limit: 10 },
    });
  });

  // An attempt left open holds nothing: POST abandons it and starts fresh, so the
  // answer to "what did I answer last time?" is the last one actually submitted.
  it('skips an attempt that is still in progress', async () => {
    vi.mocked(serverFetch).mockResolvedValue({
      items: [{ ...scored, id: 'att-3', status: 'IN_PROGRESS' }, scored],
    });

    const res = await GET(makeGetRequest(), { params });

    await expect(res.json()).resolves.toEqual({ attempt: scored });
  });

  it('reports no attempt when the learner has never finished one', async () => {
    vi.mocked(serverFetch).mockResolvedValue({ items: [] });

    const res = await GET(makeGetRequest(), { params });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ attempt: null });
  });

  /**
   * The stored record is the teacher's copy: for `translate_*` its details carry the
   * accepted translation of every sentence. Only the routing may cross into the browser.
   */
  it('strips the answer key out of a translate attempt, keeping the routing', async () => {
    vi.mocked(serverFetch).mockResolvedValue({
      items: [
        {
          ...scored,
          templateCode: 'translate_to_target',
          status: 'ROUTED_FOR_REVIEW',
          submittedAnswer: { answers: [{ itemId: 'i1', text: 'Jeg bor her i tre år.' }] },
          validationDetails: {
            totalItems: 1,
            routedItems: 1,
            passedItems: 0,
            items: [
              {
                itemId: 'i1',
                verdict: 'near',
                ref: 'Jeg har bodd her i tre år.',
                tokens: [{ t: 'missing', w: 'har', typo: null }],
                routing: 'teacher',
              },
            ],
          },
        },
      ],
    });

    const res = await GET(makeGetRequest(), { params });
    const body = (await res.json()) as { attempt: { validationDetails: unknown } };

    expect(body.attempt.validationDetails).toEqual({
      totalItems: 1,
      passedItems: 0,
      items: [{ itemId: 'i1', routing: 'teacher' }],
    });
    expect(JSON.stringify(body)).not.toContain('har bodd');
  });

  it('drops the details of the templates whose details are diagnostics', async () => {
    vi.mocked(serverFetch).mockResolvedValue({
      items: [
        {
          ...scored,
          templateCode: 'short_answer',
          validationDetails: { target: 'Det er et travelt yrke.' },
        },
      ],
    });

    const res = await GET(makeGetRequest(), { params });
    const body = (await res.json()) as { attempt: { validationDetails: unknown } };

    expect(body.attempt.validationDetails).toBeNull();
  });

  it('401 when the session is gone', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('unauthenticated', 'nope'));

    const res = await GET(makeGetRequest(), { params });

    expect(res.status).toBe(401);
  });

  it('502 when the engine cannot be reached', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('socket hang up'));

    const res = await GET(makeGetRequest(), { params });

    expect(res.status).toBe(502);
  });
});

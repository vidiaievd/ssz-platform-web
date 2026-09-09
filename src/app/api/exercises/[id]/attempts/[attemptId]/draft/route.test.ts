// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET, PUT } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

const params = Promise.resolve({ id: 'ex-1', attemptId: 'att-1' });
const DRAFT = { text: 'Hei Kari, jeg skriver fordi…', ticked: ['p1'], elapsedSeconds: 240 };

function putRequest(body: unknown) {
  return new NextRequest('http://localhost/api/exercises/ex-1/attempts/att-1/draft', {
    method: 'PUT',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function getRequest() {
  return new NextRequest('http://localhost/api/exercises/ex-1/attempts/att-1/draft');
}

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('PUT /api/exercises/[id]/attempts/[attemptId]/draft', () => {
  it('hands the work to the engine as it arrived and returns when it was taken', async () => {
    vi.mocked(serverFetch).mockResolvedValue({ savedAt: '2026-08-22T09:00:00.000Z' });

    const res = await PUT(putRequest({ draftAnswer: DRAFT }), { params });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ savedAt: '2026-08-22T09:00:00.000Z' });
    expect(serverFetch).toHaveBeenCalledWith({
      service: 'exercises',
      path: '/exercises/ex-1/attempts/att-1/draft',
      method: 'PUT',
      body: { draftAnswer: DRAFT },
    });
  });

  it('saves a draft that is an empty text — deleting everything is a save too', async () => {
    vi.mocked(serverFetch).mockResolvedValue({ savedAt: '2026-08-22T09:00:00.000Z' });

    const res = await PUT(putRequest({ draftAnswer: { text: '', ticked: [] } }), { params });

    expect(res.status).toBe(200);
  });

  it('refuses a body with no draft in it rather than storing undefined', async () => {
    const res = await PUT(putRequest({}), { params });

    expect(res.status).toBe(400);
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it('maps the failures the runner acts on differently', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('not_found', 'gone'));
    expect((await PUT(putRequest({ draftAnswer: DRAFT }), { params })).status).toBe(404);

    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('forbidden', 'not yours'));
    expect((await PUT(putRequest({ draftAnswer: DRAFT }), { params })).status).toBe(403);

    // Handed in or abandoned: there is nothing left to save into, and retrying the save
    // would never succeed.
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('validation', 'not in progress'));
    expect((await PUT(putRequest({ draftAnswer: DRAFT }), { params })).status).toBe(422);

    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('network'));
    expect((await PUT(putRequest({ draftAnswer: DRAFT }), { params })).status).toBe(502);
  });
});

describe('GET /api/exercises/[id]/attempts/[attemptId]/draft', () => {
  it('returns the draft and nothing else the attempt record holds', async () => {
    vi.mocked(serverFetch).mockResolvedValue({
      draftAnswer: DRAFT,
      draftSavedAt: '2026-08-22T09:00:00.000Z',
      // Everything below is on the record and must not travel: the submitted answer, and
      // — on a graded attempt — the validator's reading of it, which can be the key.
      submittedAnswer: { text: 'noe annet' },
      validationDetails: { expected: 'the answer' },
      status: 'IN_PROGRESS',
    });

    const body = await (await GET(getRequest(), { params })).json();

    expect(body).toEqual({ draftAnswer: DRAFT, draftSavedAt: '2026-08-22T09:00:00.000Z' });
  });

  it('answers with an empty draft rather than a hole when nothing was saved', async () => {
    vi.mocked(serverFetch).mockResolvedValue({ status: 'IN_PROGRESS' });

    const body = await (await GET(getRequest(), { params })).json();

    expect(body).toEqual({ draftAnswer: null, draftSavedAt: null });
  });

  it("does not say whether someone else's attempt exists", async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('not_found', 'gone'));

    expect((await GET(getRequest(), { params })).status).toBe(404);
  });
});

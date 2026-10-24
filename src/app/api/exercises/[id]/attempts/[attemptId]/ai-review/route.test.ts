// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

const params = Promise.resolve({ id: 'ex-1', attemptId: 'att-1' });

function makeRequest() {
  return new NextRequest('http://localhost/api/exercises/ex-1/attempts/att-1/ai-review');
}

const REVIEW = {
  outcome: 'returned',
  items: [
    {
      itemId: 'i2',
      sentenceIndex: 1,
      aspect: 'grammar',
      fragment: 'har gå',
      comment: 'After «har» the verb takes the past participle.',
      suggestion: 'har gått',
      // Whatever the engine adds later must not ride along.
      modelId: 'leak-me',
    },
  ],
  summary: 'Nesten.',
  marks: null,
  reviewedAt: '2026-10-24T10:00:00.000Z',
  disputedAt: null,
  promptVersion: 'review_direct@1',
};

beforeEach(() => {
  vi.mocked(serverFetch).mockReset();
});

describe('GET /api/exercises/[id]/attempts/[attemptId]/ai-review', () => {
  it('copies the review field by field, so nothing upstream adds reaches the learner', async () => {
    vi.mocked(serverFetch).mockResolvedValue(REVIEW);

    const res = await GET(makeRequest(), { params });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      outcome: 'returned',
      items: [
        {
          itemId: 'i2',
          sentenceIndex: 1,
          aspect: 'grammar',
          fragment: 'har gå',
          comment: 'After «har» the verb takes the past participle.',
          suggestion: 'har gått',
        },
      ],
      summary: 'Nesten.',
      marks: null,
      reviewedAt: '2026-10-24T10:00:00.000Z',
      disputedAt: null,
    });
    expect(JSON.stringify(body)).not.toContain('leak-me');
    expect(JSON.stringify(body)).not.toContain('review_direct@1');
    // No marks, no second call for the rubric.
    expect(serverFetch).toHaveBeenCalledTimes(1);
  });

  it('names an essay’s marks from the rubric frozen on the attempt, in its order', async () => {
    vi.mocked(serverFetch).mockImplementation(async (opts: { path: string }) => {
      if (opts.path.endsWith('/ai-review')) {
        return {
          ...REVIEW,
          marks: [
            { criterionId: 'c2', mark: 1, reason: 'Short.' },
            { criterionId: 'c1', mark: 3, reason: 'All points.' },
            { criterionId: 'gone', mark: 2, reason: 'Fine.' },
          ],
        };
      }
      return {
        submittedAnswer: { text: 'secret essay' },
        rubricSnapshot: {
          criteria: [
            { id: 'c1', name: 'Oppgaven' },
            { id: 'c2', name: 'Lengde' },
          ],
          passScore: 6,
        },
      };
    });

    const res = await GET(makeRequest(), { params });
    const body = await res.json();

    expect(body.marks).toEqual([
      { criterionId: 'c1', criterionName: 'Oppgaven', mark: 3, reason: 'All points.' },
      { criterionId: 'c2', criterionName: 'Lengde', mark: 1, reason: 'Short.' },
      { criterionId: 'gone', criterionName: null, mark: 2, reason: 'Fine.' },
    ]);
    expect(JSON.stringify(body)).not.toContain('secret essay');
  });

  it('keeps the marks when the rubric cannot be read', async () => {
    vi.mocked(serverFetch).mockImplementation(async (opts: { path: string }) => {
      if (opts.path.endsWith('/ai-review')) {
        return { ...REVIEW, marks: [{ criterionId: 'c1', mark: 2, reason: 'Ok.' }] };
      }
      throw new Error('engine down');
    });

    const res = await GET(makeRequest(), { params });

    expect(res.status).toBe(200);
    expect((await res.json()).marks).toEqual([
      { criterionId: 'c1', criterionName: null, mark: 2, reason: 'Ok.' },
    ]);
  });

  it('tells «no model reviewed this» apart from a missing attempt', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(
      new AppError('not_found', 'nope', { code: 'NO_AI_REVIEW', message: 'No model' }),
    );
    const none = await GET(makeRequest(), { params });
    expect(none.status).toBe(404);
    await expect(none.json()).resolves.toMatchObject({ code: 'NO_AI_REVIEW' });

    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('forbidden', 'nope'));
    const other = await GET(makeRequest(), { params });
    expect(other.status).toBe(404);
    expect(await other.json()).not.toHaveProperty('code');
  });

  it('maps a missing session to 401 and anything else to 502', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('unauthenticated', 'nope'));
    expect((await GET(makeRequest(), { params })).status).toBe(401);

    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('boom'));
    expect((await GET(makeRequest(), { params })).status).toBe(502);
  });
});

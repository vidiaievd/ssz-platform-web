// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { LessonTextSpan } from '@/features/content/types';

const PARAMS = { params: Promise.resolve({ id: 'lesson-1', variantId: 'variant-1' }) };

const MOCK_SPANS: LessonTextSpan[] = [
  {
    id: 'span-1',
    paragraphIndex: 3,
    charStart: 12,
    charEnd: 24,
    kind: 'vocab',
    refId: 'vocab-1',
    textSnapshot: 'sykepleieren',
    note: null,
    broken: false,
    brokenReason: null,
    reanchorCandidates: [],
  },
];

function makeRequest(search = '') {
  return new NextRequest(
    `http://localhost/api/content/lessons/lesson-1/variants/variant-1/spans${search}`,
  );
}

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('GET /api/content/lessons/[id]/variants/[variantId]/spans', () => {
  it('returns the spans on success', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(MOCK_SPANS);

    const res = await GET(makeRequest(), PARAMS);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(MOCK_SPANS);
  });

  it('omits the includeBroken query by default, so the reader never sees broken spans', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce([]);

    await GET(makeRequest(), PARAMS);
    expect(serverFetch).toHaveBeenCalledWith({
      service: 'content',
      path: '/lessons/lesson-1/variants/variant-1/spans',
      query: undefined,
    });
  });

  it('forwards includeBroken=true for authoring surfaces', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(MOCK_SPANS);

    await GET(makeRequest('?includeBroken=true'), PARAMS);
    expect(serverFetch).toHaveBeenCalledWith({
      service: 'content',
      path: '/lessons/lesson-1/variants/variant-1/spans',
      query: { includeBroken: 'true' },
    });
  });

  it('treats any other includeBroken value as false', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce([]);

    await GET(makeRequest('?includeBroken=1'), PARAMS);
    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({ query: undefined }),
    );
  });

  it('returns an empty array when the variant is not found', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('not_found', 'Variant not found'));

    const res = await GET(makeRequest(), PARAMS);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('returns 502 on upstream failure', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('network error'));

    const res = await GET(makeRequest(), PARAMS);
    expect(res.status).toBe(502);
  });
});

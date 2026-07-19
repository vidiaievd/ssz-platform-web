// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { LessonVideoQuestion } from '@/features/content/types';

const PARAMS = { params: Promise.resolve({ id: 'lesson-1', variantId: 'variant-1' }) };

const MOCK_QUESTION: LessonVideoQuestion = { exerciseId: 'exercise-1' };

function makeGetRequest() {
  return new NextRequest(
    'http://localhost/api/content/lessons/lesson-1/variants/variant-1/comprehension-question',
  );
}

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('GET /api/content/lessons/[id]/variants/[variantId]/comprehension-question', () => {
  it('returns the linked question on success', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(MOCK_QUESTION);

    const res = await GET(makeGetRequest(), PARAMS);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(MOCK_QUESTION);
    expect(serverFetch).toHaveBeenCalledWith({
      service: 'content',
      path: '/lessons/lesson-1/variants/variant-1/comprehension-question',
    });
  });

  it('returns null when the variant is not found', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('not_found', 'Variant not found'));
    const res = await GET(makeGetRequest(), PARAMS);
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it('returns 502 on upstream failure', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('network error'));
    const res = await GET(makeGetRequest(), PARAMS);
    expect(res.status).toBe(502);
  });
});

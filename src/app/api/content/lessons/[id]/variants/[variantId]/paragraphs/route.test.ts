// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { LessonParagraph } from '@/features/content/types';

const PARAMS = { params: Promise.resolve({ id: 'lesson-1', variantId: 'variant-1' }) };

const MOCK_PARAGRAPHS: LessonParagraph[] = [
  { target: 'Hei, hvordan har du det?', translation: 'Hi, how are you?' },
  { target: 'Bra, takk.', translation: null },
];

function makeGetRequest() {
  return new NextRequest(
    'http://localhost/api/content/lessons/lesson-1/variants/variant-1/paragraphs',
  );
}

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('GET /api/content/lessons/[id]/variants/[variantId]/paragraphs', () => {
  it('returns the paragraph translations on success', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(MOCK_PARAGRAPHS);

    const res = await GET(makeGetRequest(), PARAMS);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(MOCK_PARAGRAPHS);
    expect(serverFetch).toHaveBeenCalledWith({
      service: 'content',
      path: '/lessons/lesson-1/variants/variant-1/paragraphs',
    });
  });

  it('returns an empty array when the variant is not found', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('not_found', 'Variant not found'));
    const res = await GET(makeGetRequest(), PARAMS);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('returns 502 on upstream failure', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('network error'));
    const res = await GET(makeGetRequest(), PARAMS);
    expect(res.status).toBe(502);
  });
});

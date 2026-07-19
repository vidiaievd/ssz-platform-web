// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { LessonVideoCue } from '@/features/content/types';

const PARAMS = { params: Promise.resolve({ id: 'lesson-1', variantId: 'variant-1' }) };

const MOCK_CUES: LessonVideoCue[] = [
  { position: 0, startSeconds: 0, targetLine: 'Hei!', translationLine: 'Hi!' },
  { position: 1, startSeconds: 3.5, targetLine: 'Hvordan har du det?', translationLine: null },
];

function makeGetRequest() {
  return new NextRequest('http://localhost/api/content/lessons/lesson-1/variants/variant-1/cues');
}

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('GET /api/content/lessons/[id]/variants/[variantId]/cues', () => {
  it('returns the video cues on success', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(MOCK_CUES);

    const res = await GET(makeGetRequest(), PARAMS);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(MOCK_CUES);
    expect(serverFetch).toHaveBeenCalledWith({
      service: 'content',
      path: '/lessons/lesson-1/variants/variant-1/cues',
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

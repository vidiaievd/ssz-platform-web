// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({
  serverFetch: vi.fn(),
}));

const { getLessonProgressMap } = await import('./get-lesson-progress');
import { serverFetch } from '@/lib/api/server-fetcher';

describe('getLessonProgressMap', () => {
  it('maps SCREAMING_SNAKE_CASE statuses to lowercase keyed by lessonId', async () => {
    vi.mocked(serverFetch).mockResolvedValue([
      { contentRef: { type: 'LESSON', id: 'lesson-1' }, status: 'COMPLETED', score: 95, completedAt: '2026-06-01T00:00:00Z' },
      { contentRef: { type: 'LESSON', id: 'lesson-2' }, status: 'IN_PROGRESS', score: null, completedAt: null },
    ]);

    const map = await getLessonProgressMap();

    expect(map.get('lesson-1')).toEqual({
      lessonId: 'lesson-1',
      status: 'completed',
      score: 95,
      completedAt: '2026-06-01T00:00:00Z',
    });
    expect(map.get('lesson-2')?.status).toBe('in_progress');
  });

  it('returns an empty map when the upstream call fails', async () => {
    vi.mocked(serverFetch).mockRejectedValue(new Error('upstream down'));

    const map = await getLessonProgressMap();

    expect(map.size).toBe(0);
  });

  it('returns an empty map when the response fails validation', async () => {
    vi.mocked(serverFetch).mockResolvedValue({ unexpected: 'shape' });

    const map = await getLessonProgressMap();

    expect(map.size).toBe(0);
  });
});

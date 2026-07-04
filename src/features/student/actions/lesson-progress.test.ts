// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const mockServerFetch = vi.fn();
vi.mock('@/lib/api/server-fetcher', () => ({
  serverFetch: (...args: unknown[]) => mockServerFetch(...args),
}));

const { markLessonStartedAction, markLessonCompletedAction } = await import('./lesson-progress');

const LESSON_ID = 'lesson-1';

describe('markLessonStartedAction', () => {
  it('upserts progress with completed=false and zero time spent', async () => {
    mockServerFetch.mockResolvedValue({});

    const res = await markLessonStartedAction(LESSON_ID);

    expect(res.ok).toBe(true);
    expect(mockServerFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'progress',
        path: '/progress',
        method: 'POST',
        body: { contentType: 'LESSON', contentId: LESSON_ID, timeSpentSeconds: 0, completed: false },
      }),
    );
  });
});

describe('markLessonCompletedAction', () => {
  it('upserts progress with completed=true and a rounded, non-negative time spent', async () => {
    mockServerFetch.mockResolvedValue({});

    const res = await markLessonCompletedAction(LESSON_ID, 42.7);

    expect(res.ok).toBe(true);
    expect(mockServerFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { contentType: 'LESSON', contentId: LESSON_ID, timeSpentSeconds: 43, completed: true },
      }),
    );
  });

  it('clamps negative elapsed time to zero', async () => {
    mockServerFetch.mockResolvedValue({});

    await markLessonCompletedAction(LESSON_ID, -5);

    expect(mockServerFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ timeSpentSeconds: 0 }),
      }),
    );
  });

  it('returns a serialized error when the upstream call fails', async () => {
    mockServerFetch.mockRejectedValue(new Error('upstream down'));

    const res = await markLessonCompletedAction(LESSON_ID, 10);

    expect(res.ok).toBe(false);
  });
});

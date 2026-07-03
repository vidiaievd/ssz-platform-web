// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { CourseProgress } from '@/features/learning/types';

const PARAMS = { params: Promise.resolve({ id: 'course-1' }) };

const MOCK_PROGRESS: CourseProgress = {
  courseId: 'course-1',
  totalLessons: 10,
  completedLessons: 4,
  percentComplete: 40,
  modules: [{ moduleId: 'mod-1', status: 'in_progress', completedLessons: 4, totalLessons: 10 }],
  lessons: [],
};

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('GET /api/learning/progress/course/[id]', () => {
  it('returns course progress on success', async () => {
    vi.mocked(serverFetch).mockResolvedValue(MOCK_PROGRESS);
    const res = await GET(new Request('http://localhost/'), PARAMS);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(MOCK_PROGRESS);
    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/learning/progress/courses/course-1' }),
    );
  });

  it('returns 404 when course not found', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('not_found', 'Not found'));
    const res = await GET(new Request('http://localhost/'), PARAMS);
    expect(res.status).toBe(404);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('unauthenticated', 'Not authenticated'));
    const res = await GET(new Request('http://localhost/'), PARAMS);
    expect(res.status).toBe(401);
  });

  it('returns 502 on upstream failure', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('network error'));
    const res = await GET(new Request('http://localhost/'), PARAMS);
    expect(res.status).toBe(502);
  });
});

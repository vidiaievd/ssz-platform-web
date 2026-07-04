// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { CourseMastery } from '@/features/learning/types';

const PARAMS = { params: Promise.resolve({ id: 'course-1' }) };

const MOCK_MASTERY: CourseMastery = {
  courseId: 'course-1',
  overallMastery: 62,
  bySkill: [
    { skill: 'listening', masteryPercent: 80, successCount: 40, attemptCount: 50 },
    { skill: 'reading',   masteryPercent: 55, successCount: 22, attemptCount: 40 },
    { skill: 'writing',   masteryPercent: 30, successCount: 9,  attemptCount: 30 },
  ],
};

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('GET /api/learning/mastery/course/[id]', () => {
  it('returns mastery breakdown on success', async () => {
    vi.mocked(serverFetch).mockResolvedValue(MOCK_MASTERY);
    const res = await GET(new Request('http://localhost/'), PARAMS);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(MOCK_MASTERY);
    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/learning/mastery/courses/course-1' }),
    );
  });

  it('returns 404 when course not found', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('not_found', 'Not found'));
    const res = await GET(new Request('http://localhost/'), PARAMS);
    expect(res.status).toBe(404);
  });

  it('returns 502 on upstream failure', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('network error'));
    const res = await GET(new Request('http://localhost/'), PARAMS);
    expect(res.status).toBe(502);
  });
});

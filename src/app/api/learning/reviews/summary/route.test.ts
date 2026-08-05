// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/features/auth/api/get-current-user', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/features/learning/api/get-reviews-summary', () => ({ getReviewsSummary: vi.fn() }));

const { GET } = await import('./route');
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getReviewsSummary } from '@/features/learning/api/get-reviews-summary';
import type { ReviewsSummary } from '@/features/learning/types';

const SUMMARY: ReviewsSummary = {
  totalDue: 12,
  overdueCount: 4,
  byKind: { exercise: 5, vocabulary_word: 7 },
  breakdown: [
    {
      courseId: 'course-nb',
      courseTitle: 'Norsk B1',
      language: 'no',
      level: 'B1',
      kind: 'vocabulary_word',
      dueCount: 7,
    },
  ],
  upcoming: [],
  unattributedDue: 5,
};

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(getReviewsSummary).mockReset();
});

describe('GET /api/learning/reviews/summary', () => {
  it('returns an empty summary when unauthenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ totalDue: 0, breakdown: [] });
    expect(getReviewsSummary).not.toHaveBeenCalled();
  });

  it('returns the summary for the current user', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ roles: ['student'], userId: 'student-1' });
    vi.mocked(getReviewsSummary).mockResolvedValue(SUMMARY);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(SUMMARY);
    expect(getReviewsSummary).toHaveBeenCalledWith('student-1');
  });

  it('returns 502 when the aggregation throws', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ roles: ['student'], userId: 'student-1' });
    vi.mocked(getReviewsSummary).mockRejectedValue(new Error('boom'));

    const res = await GET();

    expect(res.status).toBe(502);
  });
});

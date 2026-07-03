// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type {
  CanDoResponse,
  CourseMastery,
  CourseProgress,
  SrsDueResponse,
} from '@/features/learning/types';
import type { Container } from '@/features/content/types';

const PARAMS = { params: Promise.resolve({ courseId: 'course-1' }) };

const MOCK_PROGRESS: CourseProgress = {
  courseId: 'course-1',
  totalLessons: 10,
  completedLessons: 4,
  percentComplete: 40,
  modules: [],
  lessons: [],
};

const MOCK_MASTERY: CourseMastery = {
  courseId: 'course-1',
  overallMastery: 72,
  bySkill: [{ skill: 'listening', masteryPercent: 80, successCount: 8, attemptCount: 10 }],
};

const MOCK_DUE: SrsDueResponse = {
  dueCount: 15,
  streakDays: 7,
  dailyLimit: 20,
  reviewedToday: 0,
  cards: [],
};

const MOCK_CAN_DO: CanDoResponse = {
  items: [
    {
      id: 'cd-1',
      descriptor: 'Can order food in Norwegian',
      cefrLevel: 'A2',
      moduleId: 'mod-1',
      evidenceCount: 3,
      state: 'unlocked',
    },
  ],
};

const MOCK_CONTAINER: Partial<Container> = {
  id: 'course-1',
  title: 'Norwegian B1',
  difficultyLevel: 'B1',
  targetLanguage: 'nb',
  containerType: 'course',
  visibility: 'public',
  accessTier: 'public_free',
  ownerUserId: 'user-1',
  slug: 'norwegian-b1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

function makeRequest() {
  return new NextRequest('http://localhost/api/learning/course-home/course-1');
}

function mockAllSuccess() {
  vi.mocked(serverFetch)
    .mockResolvedValueOnce(MOCK_PROGRESS)
    .mockResolvedValueOnce(MOCK_MASTERY)
    .mockResolvedValueOnce(MOCK_DUE)
    .mockResolvedValueOnce(MOCK_CAN_DO)
    .mockResolvedValueOnce(MOCK_CONTAINER);
}

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('GET /api/learning/course-home/[courseId]', () => {
  it('returns a composite payload on success', async () => {
    mockAllSuccess();

    const res = await GET(makeRequest(), PARAMS);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.courseInfo).toMatchObject({ id: 'course-1', title: 'Norwegian B1', cefrLevel: 'B1', targetLanguage: 'nb' });
    expect(body.progress).toEqual(MOCK_PROGRESS);
    expect(body.mastery).toEqual(MOCK_MASTERY);
    expect(body.srsDueCount).toBe(15);
    expect(body.srsStreakDays).toBe(7);
    expect(body.canDo).toEqual(MOCK_CAN_DO);
    expect(body.overdueAssignmentCount).toBe(0);
  });

  it('fires all five upstream calls in parallel (5 calls total)', async () => {
    mockAllSuccess();

    await GET(makeRequest(), PARAMS);
    expect(vi.mocked(serverFetch)).toHaveBeenCalledTimes(5);
  });

  it('returns 401 when any upstream is unauthenticated', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('unauthenticated', 'Not authenticated'));
    const res = await GET(makeRequest(), PARAMS);
    expect(res.status).toBe(401);
  });

  it('returns 404 when the course is not found', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('not_found', 'Course not found'));
    const res = await GET(makeRequest(), PARAMS);
    expect(res.status).toBe(404);
  });

  it('returns 502 on upstream failure', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('network error'));
    const res = await GET(makeRequest(), PARAMS);
    expect(res.status).toBe(502);
  });
});

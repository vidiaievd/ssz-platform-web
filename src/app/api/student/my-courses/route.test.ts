// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/features/auth/api/get-current-user', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/features/student/api/get-my-courses', () => ({
  getMyCourses: vi.fn(),
}));

const { GET } = await import('./route');
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getMyCourses } from '@/features/student/api/get-my-courses';
import type { StudentCourse } from '@/features/student/types';

const COURSE: StudentCourse = {
  containerId: 'course-b1',
  title: 'Norsk B1',
  targetLanguage: 'nb',
  level: 'B1',
  source: 'school',
  school: {
    id: 'school-1',
    slug: 'oslo',
    name: 'Oslo Language School',
    groupId: 'group-1',
    groupName: 'NO-B1-2026',
  },
  started: false,
  progressPercent: 0,
  completedItems: 0,
  totalItems: 10,
  lastAccessedAt: null,
  nextItemId: null,
  nextItemTitle: null,
};

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(getMyCourses).mockReset();
});

describe('GET /api/student/my-courses', () => {
  it('returns an empty list when unauthenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(getMyCourses).not.toHaveBeenCalled();
  });

  it('returns the aggregated courses for the current user', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ roles: ['student'], userId: 'student-1' });
    vi.mocked(getMyCourses).mockResolvedValue([COURSE]);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([COURSE]);
    expect(getMyCourses).toHaveBeenCalledWith('student-1');
  });

  it('returns 502 when the aggregator throws', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ roles: ['student'], userId: 'student-1' });
    vi.mocked(getMyCourses).mockRejectedValue(new Error('boom'));

    const res = await GET();

    expect(res.status).toBe(502);
  });
});

// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/features/auth/api/get-current-user', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/features/student/api/get-next-class', () => ({
  getNextClass: vi.fn(),
}));

const { GET } = await import('./route');
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getNextClass } from '@/features/student/api/get-next-class';
import type { NextClass } from '@/features/student/types';

const NEXT_CLASS: NextClass = {
  lessonId: 'lesson-1',
  date: '2026-07-21',
  startTime: '17:30',
  endTime: '19:00',
  room: 'Room 3',
  status: 'scheduled',
  schoolId: 'school-1',
  schoolSlug: 'oslo',
  schoolName: 'Oslo Language School',
  groupId: 'group-1',
  groupName: 'B1 Evening',
  teacher: { userId: 'teacher-1', name: 'Kari Nordmann', avatarUrl: null },
};

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(getNextClass).mockReset();
});

describe('GET /api/student/next-class', () => {
  it('returns null when unauthenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
    expect(getNextClass).not.toHaveBeenCalled();
  });

  it('returns the next class for the current user', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ roles: ['student'], userId: 'student-1' });
    vi.mocked(getNextClass).mockResolvedValue(NEXT_CLASS);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(NEXT_CLASS);
    expect(getNextClass).toHaveBeenCalledWith('student-1');
  });

  it('returns null rather than an error when the composite throws', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ roles: ['student'], userId: 'student-1' });
    vi.mocked(getNextClass).mockRejectedValue(new Error('boom'));

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });
});

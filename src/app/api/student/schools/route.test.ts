// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/features/auth/api/get-current-user', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/features/student/api/get-student-schools', () => ({
  getStudentSchools: vi.fn(),
}));

const { GET } = await import('./route');
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getStudentSchools } from '@/features/student/api/get-student-schools';
import type { StudentSchool } from '@/features/student/types';

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(getStudentSchools).mockReset();
});

describe('GET /api/student/schools', () => {
  it('returns an empty array when unauthenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(getStudentSchools).not.toHaveBeenCalled();
  });

  it('returns the aggregated schools for the current user', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ roles: ['student'], userId: 'student-1' });
    const school: StudentSchool = {
      membershipId: 'm1',
      schoolId: 's1',
      schoolSlug: 'oslo',
      schoolName: 'Oslo',
      status: 'active',
      groupId: null,
      groupName: null,
      groupAssignedSeenAt: null,
      level: null,
      mode: null,
      ageBand: null,
      teachers: [],
      schedule: [],
      nextLesson: null,
      mainCourse: null,
      materials: [],
      classmateCount: null,
    };
    vi.mocked(getStudentSchools).mockResolvedValue([school]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([school]);
    expect(getStudentSchools).toHaveBeenCalledWith('student-1');
  });

  it('returns 502 when the aggregator throws', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ roles: ['student'], userId: 'student-1' });
    vi.mocked(getStudentSchools).mockRejectedValue(new Error('boom'));
    const res = await GET();
    expect(res.status).toBe(502);
  });
});

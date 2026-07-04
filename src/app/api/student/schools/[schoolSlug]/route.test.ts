// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/features/auth/api/get-current-user', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/features/student/api/get-student-schools', () => ({
  getStudentSchool: vi.fn(),
}));

const { GET } = await import('./route');
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getStudentSchool } from '@/features/student/api/get-student-schools';
import type { StudentSchool } from '@/features/student/types';

function params(schoolSlug: string) {
  return { params: Promise.resolve({ schoolSlug }) };
}

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(getStudentSchool).mockReset();
});

describe('GET /api/student/schools/[schoolSlug]', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const res = await GET(new Request('http://test'), params('oslo'));
    expect(res.status).toBe(401);
    expect(getStudentSchool).not.toHaveBeenCalled();
  });

  it('returns 404 when the school is not found for the user', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ roles: ['student'], userId: 'student-1' });
    vi.mocked(getStudentSchool).mockResolvedValue(null);
    const res = await GET(new Request('http://test'), params('oslo'));
    expect(res.status).toBe(404);
    expect(getStudentSchool).toHaveBeenCalledWith('student-1', 'oslo');
  });

  it('returns the school detail payload', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ roles: ['student'], userId: 'student-1' });
    const school: StudentSchool = {
      membershipId: 'm1',
      schoolId: 's1',
      schoolSlug: 'oslo',
      schoolName: 'Oslo',
      status: 'active',
      groupId: 'g1',
      groupName: 'A1 Evening',
      groupAssignedSeenAt: null,
      level: null,
      mode: null,
      ageBand: null,
      teachers: [],
      schedule: [],
      nextLesson: null,
      mainCourse: null,
      materials: [],
      classmateCount: 12,
    };
    vi.mocked(getStudentSchool).mockResolvedValue(school);
    const res = await GET(new Request('http://test'), params('oslo'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(school);
  });

  it('returns 502 when the aggregator throws', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ roles: ['student'], userId: 'student-1' });
    vi.mocked(getStudentSchool).mockRejectedValue(new Error('boom'));
    const res = await GET(new Request('http://test'), params('oslo'));
    expect(res.status).toBe(502);
  });
});

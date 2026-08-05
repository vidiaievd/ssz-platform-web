// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./get-student-schools', () => ({
  getStudentSchools: vi.fn(),
}));

vi.mock('@/lib/api/server-fetcher', () => ({
  serverFetch: vi.fn(),
}));

const { getNextClass } = await import('./get-next-class');
import { getStudentSchools } from './get-student-schools';
import { serverFetch } from '@/lib/api/server-fetcher';
import type { StudentSchool } from '../types/learning';

const STUDENT_ID = 'student-1';

function school(overrides: Partial<StudentSchool> = {}): StudentSchool {
  return {
    membershipId: 'm1',
    schoolId: 'school-1',
    schoolSlug: 'oslo',
    schoolName: 'Oslo Language School',
    status: 'active',
    groupId: 'group-1',
    groupName: 'B1 Evening',
    groupAssignedSeenAt: null,
    level: 'B1',
    mode: 'in-person',
    ageBand: null,
    teachers: [{ userId: 'teacher-1', name: 'Kari Nordmann', avatarUrl: null, role: 'primary' }],
    schedule: [],
    nextLesson: null,
    mainCourse: null,
    materials: [],
    classmateCount: null,
    ...overrides,
  };
}

const LESSON = {
  id: 'lesson-1',
  date: '2026-07-21',
  startTime: '17:30',
  endTime: '19:00',
  teacherId: 'teacher-1',
  room: 'Room 3',
  status: 'scheduled',
};

beforeEach(() => {
  vi.mocked(getStudentSchools).mockReset();
  vi.mocked(serverFetch).mockReset();
});

describe('getNextClass', () => {
  it('returns the next lesson with the teacher resolved from the group roster', async () => {
    vi.mocked(getStudentSchools).mockResolvedValue([school()]);
    vi.mocked(serverFetch).mockResolvedValue([LESSON]);

    const result = await getNextClass(STUDENT_ID);

    expect(result).toEqual({
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
    });
    // Roster hit ⇒ no profile-service call.
    expect(serverFetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(serverFetch).mock.calls[0]?.[0]).toMatchObject({
      service: 'scheduling',
      path: '/scheduling/groups/group-1/lessons/next',
      query: { limit: '1' },
    });
  });

  it('falls back to the profile service for a teacher outside the group roster', async () => {
    vi.mocked(getStudentSchools).mockResolvedValue([school()]);
    vi.mocked(serverFetch).mockImplementation(async (opts) => {
      if (opts.service === 'scheduling') return [{ ...LESSON, teacherId: 'substitute-9' }];
      return { displayName: 'Ola Vikar', avatarUrl: 'https://cdn/a.png' };
    });

    const result = await getNextClass(STUDENT_ID);

    expect(result?.teacher).toEqual({
      userId: 'substitute-9',
      name: 'Ola Vikar',
      avatarUrl: 'https://cdn/a.png',
    });
  });

  it('degrades the teacher to null when the profile lookup fails', async () => {
    vi.mocked(getStudentSchools).mockResolvedValue([school()]);
    vi.mocked(serverFetch).mockImplementation(async (opts) => {
      if (opts.service === 'scheduling') return [{ ...LESSON, teacherId: 'substitute-9' }];
      throw new Error('profile-service down');
    });

    const result = await getNextClass(STUDENT_ID);

    expect(result?.lessonId).toBe('lesson-1');
    expect(result?.teacher).toBeNull();
  });

  it('picks the soonest lesson across several schools', async () => {
    vi.mocked(getStudentSchools).mockResolvedValue([
      school(),
      school({
        schoolId: 'school-2',
        schoolSlug: 'bergen',
        schoolName: 'Bergen Språk',
        groupId: 'group-2',
        groupName: 'A2 Morning',
        teachers: [],
      }),
    ]);
    vi.mocked(serverFetch).mockImplementation(async (opts) => {
      if (opts.path.includes('group-2')) {
        return [{ ...LESSON, id: 'lesson-2', date: '2026-07-20', startTime: '09:00', teacherId: null }];
      }
      return [LESSON];
    });

    const result = await getNextClass(STUDENT_ID);

    expect(result?.lessonId).toBe('lesson-2');
    expect(result?.schoolId).toBe('school-2');
    expect(result?.teacher).toBeNull();
  });

  it('normalises a full ISO date and seconds-bearing times', async () => {
    vi.mocked(getStudentSchools).mockResolvedValue([school()]);
    vi.mocked(serverFetch).mockResolvedValue([
      { ...LESSON, date: '2026-07-21T00:00:00.000Z', startTime: '17:30:00', endTime: '19:00:00' },
    ]);

    const result = await getNextClass(STUDENT_ID);

    expect(result).toMatchObject({ date: '2026-07-21', startTime: '17:30', endTime: '19:00' });
  });

  it('returns null when the student has no active group', async () => {
    vi.mocked(getStudentSchools).mockResolvedValue([
      school({ status: 'onboarding', groupId: null, groupName: null }),
    ]);

    expect(await getNextClass(STUDENT_ID)).toBeNull();
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it('returns null when scheduling-service fails', async () => {
    vi.mocked(getStudentSchools).mockResolvedValue([school()]);
    vi.mocked(serverFetch).mockRejectedValue(new Error('upstream_unavailable'));

    expect(await getNextClass(STUDENT_ID)).toBeNull();
  });

  it('returns null when scheduling-service returns an unexpected shape', async () => {
    vi.mocked(getStudentSchools).mockResolvedValue([school()]);
    vi.mocked(serverFetch).mockResolvedValue([{ id: 'lesson-1' }]);

    expect(await getNextClass(STUDENT_ID)).toBeNull();
  });

  it('returns null when the group has no upcoming lesson', async () => {
    vi.mocked(getStudentSchools).mockResolvedValue([school()]);
    vi.mocked(serverFetch).mockResolvedValue([]);

    expect(await getNextClass(STUDENT_ID)).toBeNull();
  });

  it('returns null when the schools aggregate itself fails', async () => {
    vi.mocked(getStudentSchools).mockRejectedValue(new Error('org-service down'));

    expect(await getNextClass(STUDENT_ID)).toBeNull();
  });
});

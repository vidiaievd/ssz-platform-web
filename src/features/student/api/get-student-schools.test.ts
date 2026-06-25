// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/features/school/api/get-my-schools', () => ({
  getMySchools: vi.fn(),
}));

vi.mock('@/lib/api/server-fetcher', () => ({
  serverFetch: vi.fn(),
}));

vi.mock('@/lib/scheduling/provider', () => ({
  getSchedulingProvider: vi.fn(),
}));

const { getStudentSchools, getStudentSchool } = await import('./get-student-schools');
import { getMySchools } from '@/features/school/api/get-my-schools';
import { serverFetch } from '@/lib/api/server-fetcher';
import { getSchedulingProvider } from '@/lib/scheduling/provider';
import { AppError } from '@/lib/errors/app-error';
import type { School } from '@/features/school/types';

const STUDENT_ID = 'student-1';

const SCHOOL_ACTIVE: School = {
  id: 'school-1',
  name: 'Oslo Language School',
  slug: 'oslo-language-school',
  myRole: 'STUDENT',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const SCHOOL_ONBOARDING: School = {
  id: 'school-2',
  name: 'Open School',
  slug: 'open-school',
  myRole: 'STUDENT',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const SCHOOL_NON_STUDENT: School = {
  id: 'school-3',
  name: 'My Own School',
  slug: 'my-own-school',
  myRole: 'OWNER',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

function mockServerFetch(byPath: Record<string, unknown>) {
  vi.mocked(serverFetch).mockImplementation(async (opts: { path: string }) => {
    for (const [path, value] of Object.entries(byPath)) {
      if (opts.path === path) {
        if (value instanceof Error) throw value;
        return value;
      }
    }
    throw new AppError('not_found', `Unmocked path: ${opts.path}`);
  });
}

beforeEach(() => {
  vi.mocked(getMySchools).mockReset();
  vi.mocked(serverFetch).mockReset();
  vi.mocked(getSchedulingProvider).mockReset();
});

describe('getStudentSchools', () => {
  it('excludes schools where the caller is not a STUDENT', async () => {
    vi.mocked(getMySchools).mockResolvedValue([SCHOOL_NON_STUDENT]);
    const result = await getStudentSchools(STUDENT_ID);
    expect(result).toEqual([]);
  });

  it('returns a bare row with pendingStage for a non-active membership', async () => {
    vi.mocked(getMySchools).mockResolvedValue([SCHOOL_ONBOARDING]);
    mockServerFetch({
      '/schools/school-2/memberships/me': { id: 'm2', status: 'onboarding' },
    });

    const result = await getStudentSchools(STUDENT_ID);

    expect(result).toEqual([
      expect.objectContaining({
        membershipId: 'm2',
        schoolId: 'school-2',
        schoolSlug: 'open-school',
        status: 'onboarding',
        pendingStage: 'onboarding',
        groupId: null,
        schedule: [],
      }),
    ]);
  });

  it('enriches an active membership with group, schedule, teachers, and materials', async () => {
    vi.mocked(getMySchools).mockResolvedValue([SCHOOL_ACTIVE]);
    vi.mocked(getSchedulingProvider).mockReturnValue({
      getSlots: vi.fn().mockResolvedValue([{ day: 'Mon', start: '10:00', end: '11:00', room: 'A' }]),
    } as unknown as ReturnType<typeof getSchedulingProvider>);
    mockServerFetch({
      '/schools/school-1/memberships/me': { id: 'm1', status: 'active' },
      '/schools/school-1/students/student-1/memberships': [
        {
          groupId: 'group-1',
          groupName: 'A1 Evening',
          level: 'A1',
          status: 'active',
          teachers: [{ userId: 't1', name: 'Anna', avatarUrl: null, role: 'primary' }],
        },
      ],
      '/schools/school-1/groups/group-1': {
        id: 'group-1',
        courseId: 'course-1',
        mode: 'in_person',
        ageBand: 'adults',
        studentCount: 12,
        materials: [],
      },
      '/containers/course-1': { title: 'Norsk A1 — Grunnkurs' },
    });

    const [result] = await getStudentSchools(STUDENT_ID);

    expect(result).toMatchObject({
      membershipId: 'm1',
      status: 'active',
      pendingStage: undefined,
      groupId: 'group-1',
      groupName: 'A1 Evening',
      level: 'A1',
      mode: 'in-person',
      ageBand: 'adults',
      classmateCount: 12,
      mainCourse: { id: 'course-1', courseId: 'course-1', courseName: 'Norsk A1 — Grunnkurs', isMain: true },
      teachers: [{ userId: 't1', name: 'Anna', avatarUrl: null, role: 'primary' }],
      schedule: [{ day: 'Mon', start: '10:00', end: '11:00', room: 'A' }],
    });
  });

  it('degrades schedule to empty when scheduling-service is unavailable', async () => {
    vi.mocked(getMySchools).mockResolvedValue([SCHOOL_ACTIVE]);
    vi.mocked(getSchedulingProvider).mockReturnValue({
      getSlots: vi.fn().mockRejectedValue(new AppError('upstream_unavailable', 'down')),
    } as unknown as ReturnType<typeof getSchedulingProvider>);
    mockServerFetch({
      '/schools/school-1/memberships/me': { id: 'm1', status: 'active' },
      '/schools/school-1/students/student-1/memberships': [
        { groupId: 'group-1', groupName: 'A1 Evening', level: 'A1', status: 'active', teachers: [] },
      ],
      '/schools/school-1/groups/group-1': { id: 'group-1', materials: [] },
    });

    const [result] = await getStudentSchools(STUDENT_ID);
    expect(result?.schedule).toEqual([]);
    expect(result?.nextLesson).toBeNull();
  });
});

describe('getStudentSchool', () => {
  it('returns null when the slug does not match a STUDENT-role school', async () => {
    vi.mocked(getMySchools).mockResolvedValue([SCHOOL_NON_STUDENT]);
    const result = await getStudentSchool(STUDENT_ID, 'my-own-school');
    expect(result).toBeNull();
  });

  it('returns the matching school detail', async () => {
    vi.mocked(getMySchools).mockResolvedValue([SCHOOL_ONBOARDING]);
    mockServerFetch({
      '/schools/school-2/memberships/me': { id: 'm2', status: 'placement-review' },
    });

    const result = await getStudentSchool(STUDENT_ID, 'open-school');
    expect(result).toMatchObject({ schoolSlug: 'open-school', status: 'placement-review', pendingStage: 'placement-review' });
  });
});

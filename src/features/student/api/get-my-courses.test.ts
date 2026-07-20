// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./get-student-schools', () => ({
  getStudentSchools: vi.fn(),
}));

vi.mock('@/lib/api/server-fetcher', () => ({
  serverFetch: vi.fn(),
}));

const { getMyCourses } = await import('./get-my-courses');
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
    groupName: 'NO-B1-2026',
    groupAssignedSeenAt: null,
    level: 'B1',
    mode: 'in-person',
    ageBand: null,
    teachers: [],
    schedule: [],
    nextLesson: null,
    mainCourse: { id: 'course-b1', courseId: 'course-b1', courseName: 'Norsk B1', isMain: true },
    materials: [],
    classmateCount: null,
    ...overrides,
  };
}

function container(id: string, title: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    title,
    targetLanguage: 'nb',
    difficultyLevel: 'B1',
    containerType: 'course',
    lessonCount: 10,
    ...extra,
  };
}

/**
 * Wires every upstream by service name so each test states only what it cares
 * about. `groups` maps a groupId to the courses that group carries.
 */
function mockUpstreams(opts: {
  progress?: unknown;
  enrollments?: unknown;
  containers?: Record<string, unknown>;
  groupMemberships?: Array<{ groupId: string; groupName: string; status: string }>;
  groups?: Record<string, { courseId?: string; materials?: Array<{ courseId: string }> }>;
}) {
  vi.mocked(serverFetch).mockImplementation(async (o) => {
    if (o.service === 'progress') return opts.progress ?? [];
    if (o.service === 'enrollment') return opts.enrollments ?? [];
    if (o.service === 'organization') {
      if (o.path.endsWith('/memberships')) return opts.groupMemberships ?? [];
      const groupId = o.path.split('/').pop()!;
      return opts.groups?.[groupId] ?? {};
    }
    if (o.service === 'content') {
      const id = o.path.split('/').pop()!;
      const found = opts.containers?.[id];
      if (!found) throw new Error('not found');
      return found;
    }
    throw new Error(`unexpected service ${o.service}`);
  });
}

const GROUP_1 = { groupId: 'group-1', groupName: 'NO-B1-2026', status: 'active' };

beforeEach(() => {
  vi.mocked(getStudentSchools).mockReset();
  vi.mocked(serverFetch).mockReset();
});

describe('getMyCourses', () => {
  /** The regression this endpoint exists for: assigned through a group, never opened. */
  it("returns a school course the student has never opened", async () => {
    vi.mocked(getStudentSchools).mockResolvedValue([school()]);
    mockUpstreams({
      progress: [],
      enrollments: [],
      groupMemberships: [GROUP_1],
      groups: { 'group-1': { courseId: 'course-b1' } },
      containers: { 'course-b1': container('course-b1', 'Norsk B1') },
    });

    const courses = await getMyCourses(STUDENT_ID);

    expect(courses).toHaveLength(1);
    expect(courses[0]).toMatchObject({
      containerId: 'course-b1',
      title: 'Norsk B1',
      source: 'school',
      started: false,
      progressPercent: 0,
      completedItems: 0,
      // No progress row, so the container's own lesson count stands in.
      totalItems: 10,
      nextItemId: null,
    });
    expect(courses[0]?.school).toMatchObject({ name: 'Oslo Language School', groupName: 'NO-B1-2026' });
  });

  it('includes additional group materials alongside the main course', async () => {
    vi.mocked(getStudentSchools).mockResolvedValue([school()]);
    mockUpstreams({
      groupMemberships: [GROUP_1],
      groups: { 'group-1': { courseId: 'course-b1', materials: [{ courseId: 'course-a2' }] } },
      containers: {
        'course-b1': container('course-b1', 'Norsk B1'),
        'course-a2': container('course-a2', 'Norsk A2'),
      },
    });

    const courses = await getMyCourses(STUDENT_ID);

    expect(courses.map((c) => c.containerId).sort()).toEqual(['course-a2', 'course-b1']);
    expect(courses.every((c) => c.source === 'school')).toBe(true);
  });

  /**
   * `StudentSchool` models one group per school, so reusing it dropped the
   * courses of every other group the student belongs to.
   */
  it('returns courses from every active group, not just the first', async () => {
    vi.mocked(getStudentSchools).mockResolvedValue([school()]);
    mockUpstreams({
      groupMemberships: [
        GROUP_1,
        { groupId: 'group-2', groupName: 'NO-A2-2026', status: 'active' },
        { groupId: 'group-past', groupName: 'NO-A1-2025', status: 'past' },
      ],
      groups: {
        'group-1': { courseId: 'course-b1' },
        'group-2': { courseId: 'course-a2' },
        'group-past': { courseId: 'course-a1' },
      },
      containers: {
        'course-b1': container('course-b1', 'Norsk B1'),
        'course-a2': container('course-a2', 'Norsk A2'),
        'course-a1': container('course-a1', 'Norsk A1'),
      },
    });

    const courses = await getMyCourses(STUDENT_ID);

    expect(courses.map((c) => c.containerId).sort()).toEqual(['course-a2', 'course-b1']);
    expect(courses.find((c) => c.containerId === 'course-a2')?.school?.groupName).toBe('NO-A2-2026');
  });

  /**
   * A school can place a student in a group before their application row is
   * tidied up to `active`. The group placement is the real grant.
   */
  it('returns group courses even while the school membership reads onboarding', async () => {
    vi.mocked(getStudentSchools).mockResolvedValue([school({ status: 'onboarding' })]);
    mockUpstreams({
      groupMemberships: [GROUP_1],
      groups: { 'group-1': { courseId: 'course-b1' } },
      containers: { 'course-b1': container('course-b1', 'Norsk B1') },
    });

    const courses = await getMyCourses(STUDENT_ID);

    expect(courses).toHaveLength(1);
    expect(courses[0]?.source).toBe('school');
  });

  /** A school-granted enrollment names its school even with no group material. */
  it('labels a school-granted enrollment as a school course', async () => {
    vi.mocked(getStudentSchools).mockResolvedValue([school({ mainCourse: null })]);
    mockUpstreams({
      enrollments: [{ containerId: 'course-b1', schoolId: 'school-1', status: 'ACTIVE' }],
      groupMemberships: [],
      containers: { 'course-b1': container('course-b1', 'Norsk B1') },
    });

    const courses = await getMyCourses(STUDENT_ID);

    expect(courses[0]).toMatchObject({ source: 'school' });
    expect(courses[0]?.school?.name).toBe('Oslo Language School');
  });

  it('overlays progress on a course that has been started', async () => {
    vi.mocked(getStudentSchools).mockResolvedValue([school()]);
    mockUpstreams({
      progress: [
        {
          containerId: 'course-b1',
          completedItems: 3,
          totalItems: 12,
          progressPercent: 25,
          lastAccessedAt: '2026-07-19T10:00:00.000Z',
          nextItemId: 'lesson-4',
          nextItemTitle: 'Leksjon 4',
        },
      ],
      groupMemberships: [GROUP_1],
      groups: { 'group-1': { courseId: 'course-b1' } },
      containers: { 'course-b1': container('course-b1', 'Norsk B1') },
    });

    const courses = await getMyCourses(STUDENT_ID);

    expect(courses[0]).toMatchObject({
      started: true,
      progressPercent: 25,
      completedItems: 3,
      // The progress row's own total wins over the container's lesson count.
      totalItems: 12,
      nextItemId: 'lesson-4',
    });
  });

  it('marks self-enrolled courses as self-study', async () => {
    vi.mocked(getStudentSchools).mockResolvedValue([]);
    mockUpstreams({
      enrollments: [{ containerId: 'course-solo', status: 'ACTIVE' }],
      containers: { 'course-solo': container('course-solo', 'Español A1', { targetLanguage: 'es' }) },
    });

    const courses = await getMyCourses(STUDENT_ID);

    expect(courses[0]).toMatchObject({ source: 'self', school: null, started: false });
  });

  it('ignores non-active enrollments', async () => {
    vi.mocked(getStudentSchools).mockResolvedValue([]);
    mockUpstreams({
      enrollments: [{ containerId: 'course-old', status: 'UNENROLLED' }],
      containers: { 'course-old': container('course-old', 'Dropped') },
    });

    expect(await getMyCourses(STUDENT_ID)).toEqual([]);
  });

  it('keeps the school label when the student is also self-enrolled in the same course', async () => {
    vi.mocked(getStudentSchools).mockResolvedValue([school()]);
    mockUpstreams({
      enrollments: [{ containerId: 'course-b1', status: 'ACTIVE' }],
      groupMemberships: [GROUP_1],
      groups: { 'group-1': { courseId: 'course-b1' } },
      containers: { 'course-b1': container('course-b1', 'Norsk B1') },
    });

    const courses = await getMyCourses(STUDENT_ID);

    expect(courses).toHaveLength(1);
    expect(courses[0]?.source).toBe('school');
  });

  it('skips courses whose container cannot be described', async () => {
    vi.mocked(getStudentSchools).mockResolvedValue([school()]);
    mockUpstreams({ groupMemberships: [GROUP_1], groups: { 'group-1': { courseId: 'course-b1' } }, containers: {} });

    expect(await getMyCourses(STUDENT_ID)).toEqual([]);
  });

  it('still returns school courses when learning-service is down', async () => {
    vi.mocked(getStudentSchools).mockResolvedValue([school()]);
    vi.mocked(serverFetch).mockImplementation(async (o) => {
      if (o.service === 'content') return container('course-b1', 'Norsk B1');
      if (o.service === 'organization') {
        return o.path.endsWith('/memberships') ? [GROUP_1] : { courseId: 'course-b1' };
      }
      throw new Error('learning-service down');
    });

    const courses = await getMyCourses(STUDENT_ID);

    expect(courses).toHaveLength(1);
    expect(courses[0]?.started).toBe(false);
  });

  it('ignores memberships that have no group yet', async () => {
    vi.mocked(getStudentSchools).mockResolvedValue([
      school({ status: 'onboarding', groupId: null, mainCourse: null }),
    ]);
    mockUpstreams({ groupMemberships: [] });

    expect(await getMyCourses(STUDENT_ID)).toEqual([]);
  });

  it('reuses a prefetched school list instead of refetching it', async () => {
    mockUpstreams({
      groupMemberships: [GROUP_1],
      groups: { 'group-1': { courseId: 'course-b1' } },
      containers: { 'course-b1': container('course-b1', 'Norsk B1') },
    });

    const courses = await getMyCourses(STUDENT_ID, [school()]);

    expect(courses).toHaveLength(1);
    expect(getStudentSchools).not.toHaveBeenCalled();
  });
});

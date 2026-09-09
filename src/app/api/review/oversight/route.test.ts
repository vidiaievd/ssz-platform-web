// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));
vi.mock('@/lib/api/profile-directory', () => ({ fetchProfileSummaries: vi.fn() }));
vi.mock('@/features/auth/api/get-current-user', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/features/school/api/get-my-schools', () => ({ getMySchools: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { fetchProfileSummaries } from '@/lib/api/profile-directory';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getMySchools } from '@/features/school/api/get-my-schools';
import type { ReviewOversightResponse } from '@/features/review/types/oversight';

const SCHOOL_ID = '22222222-2222-4222-8222-222222222222';

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

/** Two waiting in one group, one in another; 90 h is late against the school's 48. */
const AGGREGATE = {
  since: '2026-08-01T00:00:00.000Z',
  pending: [
    { containerId: 'course-1', groupId: 'group-1', submittedAt: [hoursAgo(2), hoursAgo(90)] },
    { containerId: 'course-1', groupId: 'group-2', submittedAt: [hoursAgo(10)] },
  ],
  reviewed: [
    {
      reviewerId: 'teacher-1',
      containerId: 'course-1',
      groupId: 'group-1',
      durationsHours: [4, 8],
    },
  ],
  unassigned: [],
  truncated: false,
};

const REVIEWERS = {
  groups: [
    {
      groupId: 'group-1',
      teachers: [
        { userId: 'teacher-1', name: 'Ingrid Sæther', role: 'primary' },
        { userId: 'teacher-2', name: 'Marius Holt', role: 'co_primary' },
      ],
    },
    {
      groupId: 'group-2',
      teachers: [{ userId: 'teacher-3', name: 'Per Nygård', role: 'primary' }],
    },
  ],
};

const QUEUE = {
  groups: [
    {
      items: [
        {
          attemptId: 'att-late',
          userId: 'student-1',
          groupId: 'group-1',
          containerId: 'course-1',
          path: { course: 'Ny i Norge A2', exercise: 'Perfektum' },
          submittedAt: hoursAgo(90),
        },
        {
          attemptId: 'att-fresh',
          userId: 'student-2',
          groupId: 'group-1',
          containerId: 'course-1',
          path: { course: 'Ny i Norge A2', exercise: 'Perfektum' },
          submittedAt: hoursAgo(2),
        },
      ],
    },
  ],
  nextCursor: null,
};

function upstream(
  overrides: {
    aggregate?: unknown;
    reviewers?: unknown;
    queue?: unknown;
    schoolSla?: number | null;
    courseSla?: { respondWithinHours: number | null; overridden: boolean };
  } = {},
) {
  vi.mocked(serverFetch).mockImplementation(async (opts: { path: string }) => {
    if (opts.path === '/internal/attempts/review/aggregate')
      return overrides.aggregate ?? AGGREGATE;
    if (opts.path === '/internal/review/reviewers') return overrides.reviewers ?? REVIEWERS;
    if (opts.path === '/internal/attempts/review/queue') return overrides.queue ?? QUEUE;
    if (opts.path.startsWith('/schools') && opts.path.endsWith('/review-settings')) {
      return { respondWithinHours: 'schoolSla' in overrides ? overrides.schoolSla : 48 };
    }
    if (opts.path.endsWith('/review-settings')) {
      return overrides.courseSla ?? { respondWithinHours: null, overridden: false };
    }
    if (opts.path.endsWith('/groups')) {
      return [
        { id: 'group-1', name: 'B1 kveld' },
        { id: 'group-2', name: 'A2 dag' },
      ];
    }
    if (/^\/containers\/[^/]+$/.test(opts.path)) return { title: 'Ny i Norge A2' };
    throw new Error(`unexpected upstream call: ${opts.path}`);
  });
}

function request(query = `?school=${SCHOOL_ID}&period=30`): NextRequest {
  return new NextRequest(`http://localhost/api/review/oversight${query}`);
}

async function body(response: Response): Promise<ReviewOversightResponse> {
  return (await response.json()) as ReviewOversightResponse;
}

/** A fresh caller each time, so the route's per-user cache never spans two cases. */
let caller = 0;

beforeEach(() => {
  vi.clearAllMocks();
  caller += 1;
  vi.mocked(getCurrentUser).mockResolvedValue({ userId: `admin-${caller}` } as never);
  vi.mocked(getMySchools).mockResolvedValue([
    { id: SCHOOL_ID, name: 'Skolen', myRole: 'ADMIN' },
  ] as never);
  vi.mocked(fetchProfileSummaries).mockResolvedValue({
    'student-1': { userId: 'student-1', displayName: 'Anna Kowalska' },
  } as never);
  upstream();
});

describe('GET /api/review/oversight', () => {
  it('refuses a teacher of the school, not only a stranger', async () => {
    vi.mocked(getMySchools).mockResolvedValue([
      { id: SCHOOL_ID, name: 'Skolen', myRole: 'TEACHER' },
    ] as never);

    expect((await GET(request())).status).toBe(403);
  });

  it('refuses someone who is not in the school at all', async () => {
    vi.mocked(getMySchools).mockResolvedValue([] as never);

    expect((await GET(request())).status).toBe(403);
  });

  it('counts the school queue once and each reviewer queue in full', async () => {
    const result = await body(await GET(request()));

    expect(result.summary.pending).toBe(3);
    expect(result.summary.overdue).toBe(1);

    const shared = result.teachers.find((teacher) => teacher.id === 'teacher-1');
    const alone = result.teachers.find((teacher) => teacher.id === 'teacher-3');
    // Two reviewers on group-1: both carry its two submissions, and the row says so.
    expect(shared?.pending).toBe(2);
    expect(shared?.shared).toBe(true);
    expect(alone?.pending).toBe(1);
    expect(alone?.shared).toBe(false);
  });

  it('reports the horizon the figures start from', async () => {
    const result = await body(await GET(request()));
    expect(result.since).toBe('2026-08-01T00:00:00.000Z');
  });

  it('answers with the median of the period, not the mean', async () => {
    const result = await body(await GET(request()));
    expect(result.summary.medianHours).toBe(6);
    expect(result.teachers.find((t) => t.id === 'teacher-1')?.medianHours).toBe(6);
  });

  it('names the late submissions and who is responsible for them', async () => {
    const result = await body(await GET(request()));

    expect(result.stuck).toHaveLength(1);
    expect(result.stuck[0]).toMatchObject({
      id: 'att-late',
      studentName: 'Anna Kowalska',
      exerciseTitle: 'Perfektum',
      groupName: 'B1 kveld',
      teacherName: 'Ingrid Sæther',
      unassigned: false,
    });
  });

  it('says in the row itself when a submission has no reviewer at all', async () => {
    upstream({
      aggregate: {
        ...AGGREGATE,
        pending: [{ containerId: null, groupId: null, submittedAt: [hoursAgo(120)] }],
        unassigned: [
          {
            attemptId: 'att-orphan',
            userId: 'student-9',
            exerciseId: 'ex-9',
            submittedAt: hoursAgo(120),
          },
        ],
      },
      queue: { groups: [], nextCursor: null },
    });

    const result = await body(await GET(request()));

    expect(result.stuck).toHaveLength(1);
    expect(result.stuck[0]).toMatchObject({
      id: 'att-orphan',
      unassigned: true,
      groupName: null,
      teacherName: null,
    });
    // Nobody reviews it, so it belongs to no teacher row — but it is still in the school's
    // queue, and the summary counts it.
    expect(result.teachers).toHaveLength(0);
    expect(result.summary.pending).toBe(1);
  });

  it('colours a course against its own promise where it overrides the school', async () => {
    upstream({ courseSla: { respondWithinHours: 24, overridden: true } });

    const result = await body(await GET(request()));
    const course = result.courses[0];

    expect(course).toMatchObject({ id: 'course-1', slaHours: 24, overridden: true });
    // The same queue, held to a shorter promise: 90 h is past it, 10 h and 2 h are not.
    expect(result.summary.overdue).toBe(1);
    expect(course?.overdue).toBe(1);
  });

  it('holds nobody to a promise the school never made', async () => {
    upstream({ schoolSla: null });

    const result = await body(await GET(request()));

    expect(result.schoolSlaHours).toBeNull();
    expect(result.summary.overdue).toBe(0);
    expect(result.stuck).toHaveLength(0);
  });

  it('answers 502 when the engine cannot report the load', async () => {
    vi.mocked(serverFetch).mockRejectedValue(new Error('down'));

    expect((await GET(request())).status).toBe(502);
  });
});

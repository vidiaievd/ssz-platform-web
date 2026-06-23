// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/groups/api/queries', () => ({
  getSchoolTeachersResult: vi.fn(),
  getTimetable: vi.fn(),
}));

const { GET } = await import('./route');
const { getSchoolTeachersResult, getTimetable } = await import('@/features/groups/api/queries');
const mockGetTeachers = vi.mocked(getSchoolTeachersResult);
const mockGetTimetable = vi.mocked(getTimetable);

const PARAMS = { params: Promise.resolve({ id: 'school-1' }) };

const MOCK_ORG_TEACHERS = [
  { userId: 't1', name: 'Anna', avatarUrl: null, maxWeeklyHours: 20, langs: ['nb'] },
];

describe('GET /api/schools/[id]/scheduling/command-center', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with composite command center data', async () => {
    mockGetTeachers.mockResolvedValue({ teachers: MOCK_ORG_TEACHERS, error: null });
    mockGetTimetable.mockResolvedValue({
      data: [
        {
          userId: 't1',
          name: 'Anna',
          avatarUrl: null,
          hours: 10,
          max: 20,
          pct: 50,
          overloaded: false,
          groups: 2,
          conflicts: 0,
          lessons: [],
        },
      ],
    });

    const req = new NextRequest('http://localhost/api/schools/school-1/scheduling/command-center');
    const res = await GET(req, PARAMS);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kpis.utilizationAvgPct).toBe(50);
    expect(body.teachers).toHaveLength(1);
    expect(body.teachers[0].teacherId).toBe('t1');
    expect(body.teachers[0].utilizationPct).toBe(50);
    expect(body.violations).toHaveLength(0);
    expect(body.teachersError).toBeNull();
    expect(mockGetTeachers).toHaveBeenCalledWith('school-1');
  });

  it('returns 200 with a teachersError when the upstream roster fetch fails', async () => {
    mockGetTeachers.mockResolvedValue({ teachers: [], error: 'scheduling-service not ready' });
    mockGetTimetable.mockResolvedValue({ data: [] });

    const req = new NextRequest('http://localhost/api/schools/school-1/scheduling/command-center');
    const res = await GET(req, PARAMS);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.teachers).toHaveLength(0);
    expect(body.teachersError).toBe('scheduling-service not ready');
  });

  it('returns 502 when teacher fetch throws', async () => {
    mockGetTeachers.mockRejectedValue(new Error('service down'));

    const req = new NextRequest('http://localhost/api/schools/school-1/scheduling/command-center');
    const res = await GET(req, PARAMS);

    expect(res.status).toBe(502);
  });
});

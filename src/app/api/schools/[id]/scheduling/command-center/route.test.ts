// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/groups/api/queries', () => ({
  getSchoolTeachers: vi.fn(),
}));

const { GET } = await import('./route');
const { getSchoolTeachers } = await import('@/features/groups/api/queries');
const mockGetTeachers = vi.mocked(getSchoolTeachers);

const PARAMS = { params: Promise.resolve({ id: 'school-1' }) };

const MOCK_ORG_TEACHERS = [
  { userId: 't1', name: 'Anna', avatarUrl: null, maxWeeklyHours: 20, langs: ['nb'] },
];

describe('GET /api/schools/[id]/scheduling/command-center', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with composite command center data', async () => {
    mockGetTeachers.mockResolvedValue(MOCK_ORG_TEACHERS);

    const req = new NextRequest('http://localhost/api/schools/school-1/scheduling/command-center');
    const res = await GET(req, PARAMS);

    expect(res.status).toBe(200);
    const body = await res.json();
    // scheduling metrics are placeholders until scheduling-service is wired up
    expect(body.kpis.utilizationAvgPct).toBe(0);
    expect(body.teachers).toHaveLength(1);
    expect(body.teachers[0].teacherId).toBe('t1');
    expect(body.violations).toHaveLength(0);
    expect(mockGetTeachers).toHaveBeenCalledWith('school-1');
  });

  it('returns 502 when teacher fetch throws', async () => {
    mockGetTeachers.mockRejectedValue(new Error('service down'));

    const req = new NextRequest('http://localhost/api/schools/school-1/scheduling/command-center');
    const res = await GET(req, PARAMS);

    expect(res.status).toBe(502);
  });
});

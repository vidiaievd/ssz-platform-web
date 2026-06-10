// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurriculumPlan } from '@/features/teachers/types';

vi.mock('@/lib/scheduling/provider', () => ({
  getSchedulingProvider: vi.fn(),
}));

const { GET, PATCH } = await import('./route');
const { getSchedulingProvider } = await import('@/lib/scheduling/provider');
const mockGetProvider = vi.mocked(getSchedulingProvider);

const PARAMS = { params: Promise.resolve({ id: 'school-1', groupId: 'group-a1' }) };

const BASE_PLAN: CurriculumPlan = {
  planId: 'plan-a1',
  groupId: 'group-a1',
  targetWeeklyHours: 6,
  progressPct: 33,
  units: [
    {
      unitId: 'u1',
      title: 'Greetings',
      order: 1,
      plannedSessions: 6,
      deliveredSessions: 2,
      requiredLevel: 'A1',
      status: 'active',
    },
    {
      unitId: 'u2',
      title: 'Numbers',
      order: 2,
      plannedSessions: 4,
      deliveredSessions: 0,
      requiredLevel: 'A1',
      status: 'planned',
    },
  ],
};

describe('GET /api/schools/[id]/curriculum/[groupId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with curriculum plan', async () => {
    mockGetProvider.mockReturnValue({
      getCurriculum: vi.fn().mockResolvedValue(BASE_PLAN),
    } as never);

    const req = new NextRequest('http://localhost/api/schools/school-1/curriculum/group-a1');
    const res = await GET(req, PARAMS);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.planId).toBe('plan-a1');
    expect(body.units).toHaveLength(2);
  });

  it('returns 502 when provider throws', async () => {
    mockGetProvider.mockReturnValue({
      getCurriculum: vi.fn().mockRejectedValue(new Error('down')),
    } as never);

    const req = new NextRequest('http://localhost/api/schools/school-1/curriculum/group-a1');
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(502);
  });
});

describe('PATCH /api/schools/[id]/curriculum/[groupId] — override', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks unit as overridden and persists the updated plan', async () => {
    const savedPlan = structuredClone(BASE_PLAN);
    const mockPut = vi.fn().mockResolvedValue(undefined);

    mockGetProvider.mockReturnValue({
      getCurriculum: vi.fn().mockResolvedValue(savedPlan),
      putCurriculum: mockPut,
    } as never);

    const req = new NextRequest('http://localhost/api/schools/school-1/curriculum/group-a1', {
      method: 'PATCH',
      body: JSON.stringify({
        override: { unitId: 'u1', reason: 'Student request' },
        plan: BASE_PLAN,
      }),
    });
    const res = await PATCH(req, PARAMS);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    expect(mockPut).toHaveBeenCalledOnce();
    const [, calledPlan] = mockPut.mock.calls[0]!;
    const overriddenUnit = (calledPlan as CurriculumPlan).units.find((u) => u.unitId === 'u1');
    expect(overriddenUnit?.status).toBe('overridden');
  });

  it('reorders units when reorder array is provided', async () => {
    const savedPlan = structuredClone(BASE_PLAN);
    const mockPut = vi.fn().mockResolvedValue(undefined);

    mockGetProvider.mockReturnValue({
      getCurriculum: vi.fn().mockResolvedValue(savedPlan),
      putCurriculum: mockPut,
    } as never);

    const req = new NextRequest('http://localhost/api/schools/school-1/curriculum/group-a1', {
      method: 'PATCH',
      body: JSON.stringify({ reorder: ['u2', 'u1'] }), // swap order
    });
    const res = await PATCH(req, PARAMS);

    expect(res.status).toBe(200);
    const [, calledPlan] = mockPut.mock.calls[0]!;
    const units = (calledPlan as CurriculumPlan).units;
    expect(units[0]?.unitId).toBe('u2');
    expect(units[0]?.order).toBe(1);
    expect(units[1]?.unitId).toBe('u1');
    expect(units[1]?.order).toBe(2);
  });

  it('returns 400 on invalid JSON', async () => {
    mockGetProvider.mockReturnValue({
      getCurriculum: vi.fn(),
      putCurriculum: vi.fn(),
    } as never);

    const req = new NextRequest('http://localhost/api/schools/school-1/curriculum/group-a1', {
      method: 'PATCH',
      body: 'not-json',
    });
    const res = await PATCH(req, PARAMS);
    expect(res.status).toBe(400);
  });
});

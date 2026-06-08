// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommandCenterData } from '@/lib/scheduling/provider';

vi.mock('@/lib/scheduling/provider', () => ({
  getSchedulingProvider: vi.fn(),
}));

const { GET } = await import('./route');
const { getSchedulingProvider } = await import('@/lib/scheduling/provider');
const mockGetProvider = vi.mocked(getSchedulingProvider);

const PARAMS = { params: Promise.resolve({ id: 'school-1' }) };

const MOCK_DATA: CommandCenterData = {
  kpis: {
    utilizationAvgPct: 72,
    spareCapacityHours: 8,
    overloadedCount: 1,
    clashCount: 0,
    vacancyCount: 2,
  },
  teachers: [
    {
      teacherId: 't1',
      name: 'Anna',
      avatarUrl: null,
      languages: ['nb'],
      contactHours: 18,
      prepHours: 4.5,
      effectiveLoad: 22.5,
      utilizationPct: 90,
      healthState: 'warn',
      groupCount: 3,
      conflictCount: 0,
      maxWeeklyContactHours: 20,
    },
  ],
  violations: [
    {
      alertId: 'a1',
      kind: 'near-cap',
      severity: 'warn',
      state: 'raised',
      teacherId: 't1',
      message: 'Near capacity',
      occurredAt: '2026-06-01T10:00:00Z',
    },
  ],
  vacancies: [],
  roomLoad: [],
};

describe('GET /api/schools/[id]/scheduling/command-center', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with composite command center data', async () => {
    const mockProvider = { commandCenter: vi.fn().mockResolvedValue(MOCK_DATA) };
    mockGetProvider.mockReturnValue(mockProvider as never);

    const req = new NextRequest('http://localhost/api/schools/school-1/scheduling/command-center');
    const res = await GET(req, PARAMS);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kpis.utilizationAvgPct).toBe(72);
    expect(body.teachers).toHaveLength(1);
    expect(body.violations).toHaveLength(1);
    expect(mockProvider.commandCenter).toHaveBeenCalledWith('school-1');
  });

  it('returns 502 when scheduling provider throws', async () => {
    const mockProvider = {
      commandCenter: vi.fn().mockRejectedValue(new Error('provider down')),
    };
    mockGetProvider.mockReturnValue(mockProvider as never);

    const req = new NextRequest('http://localhost/api/schools/school-1/scheduling/command-center');
    const res = await GET(req, PARAMS);

    expect(res.status).toBe(502);
  });
});

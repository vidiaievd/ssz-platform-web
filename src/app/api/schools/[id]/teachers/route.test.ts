// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/scheduling/provider', () => ({
  getSchedulingProvider: vi.fn(),
}));

const { GET, POST } = await import('./route');

const PARAMS = { params: Promise.resolve({ id: 'school-1' }) };

describe('GET /api/schools/[id]/teachers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with teacher list', async () => {
    const { getSchedulingProvider } = await import('@/lib/scheduling/provider');
    vi.mocked(getSchedulingProvider).mockReturnValue({
      commandCenter: vi.fn().mockResolvedValue({
        kpis: { utilizationAvgPct: 0, spareCapacityHours: 0, overloadedCount: 0, clashCount: 0, vacancyCount: 0 },
        teachers: [{ teacherId: 't1', name: 'Anna' }],
        violations: [],
        vacancies: [],
        roomLoad: [],
      }),
    } as never);

    const req = new NextRequest('http://localhost/api/schools/school-1/teachers');
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].teacherId).toBe('t1');
  });

  it('returns 502 when provider fails', async () => {
    const { getSchedulingProvider } = await import('@/lib/scheduling/provider');
    vi.mocked(getSchedulingProvider).mockReturnValue({
      commandCenter: vi.fn().mockRejectedValue(new Error('down')),
    } as never);

    const req = new NextRequest('http://localhost/api/schools/school-1/teachers');
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(502);
  });
});

describe('POST /api/schools/[id]/teachers (invite)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 201 with branch:added for valid email', async () => {
    const req = new NextRequest('http://localhost/api/schools/school-1/teachers', {
      method: 'POST',
      body: JSON.stringify({
        email: 'anna@example.com',
        maxWeeklyContactHours: 20,
        employmentType: 'full',
      }),
    });
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.branch).toBe('added');
    expect(typeof body.name).toBe('string');
  });

  it('returns 400 on invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/schools/school-1/teachers', {
      method: 'POST',
      body: 'not-json',
    });
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(400);
  });

  it('derives teacher name from email local part', async () => {
    const req = new NextRequest('http://localhost/api/schools/school-1/teachers', {
      method: 'POST',
      body: JSON.stringify({
        email: 'john.doe@school.no',
        maxWeeklyContactHours: 15,
        employmentType: 'part',
      }),
    });
    const res = await POST(req, PARAMS);
    const body = await res.json();
    expect(body.name).toBe('john.doe');
  });
});

// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
  headers: async () => new Headers(),
}));

vi.mock('@/lib/api/server-fetcher', () => ({
  serverFetch: vi.fn(),
}));

vi.mock('@/lib/scheduling/command-center', () => ({
  buildCommandCenter: vi.fn(),
}));

const { GET, POST } = await import('./route');
const { serverFetch } = await import('@/lib/api/server-fetcher');
const { buildCommandCenter } = await import('@/lib/scheduling/command-center');
const mockFetch = vi.mocked(serverFetch);
const mockBuild = vi.mocked(buildCommandCenter);

const PARAMS = { params: Promise.resolve({ id: 'school-1' }) };

describe('GET /api/schools/[id]/teachers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with teacher list', async () => {
    mockBuild.mockResolvedValue({
      kpis: { utilizationAvgPct: 0, spareCapacityHours: 0, overloadedCount: 0, clashCount: 0, vacancyCount: 0 },
      teachers: [{ teacherId: 't1', name: 'Anna' }],
      violations: [],
      vacancies: [],
      roomLoad: [],
      teachersError: null,
    } as never);

    const req = new NextRequest('http://localhost/api/schools/school-1/teachers');
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].teacherId).toBe('t1');
  });

  it('returns 502 when provider fails', async () => {
    mockBuild.mockRejectedValue(new Error('down'));

    const req = new NextRequest('http://localhost/api/schools/school-1/teachers');
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(502);
  });
});

describe('POST /api/schools/[id]/teachers (invite)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 201 with branch:added for valid email', async () => {
    // lookup → user found with TEACHER role; add member → ok
    mockFetch
      .mockResolvedValueOnce({ userId: 'u1', displayName: 'Anna', roles: ['TEACHER'] })
      .mockResolvedValueOnce({});

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

  it('derives teacher name from email local part when displayName is absent', async () => {
    // lookup → user found with TEACHER role but no displayName; add member → ok
    mockFetch
      .mockResolvedValueOnce({ userId: 'u2', displayName: null, roles: ['TEACHER'] })
      .mockResolvedValueOnce({});

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

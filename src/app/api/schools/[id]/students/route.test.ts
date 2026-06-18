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

vi.mock('@/lib/scheduling/provider', () => ({
  getSchedulingProvider: vi.fn(() => ({
    teacherConflicts: vi.fn().mockResolvedValue([]),
  })),
}));

const { GET, POST } = await import('./route');
const { serverFetch } = await import('@/lib/api/server-fetcher');
const mockFetch = vi.mocked(serverFetch);

const PARAMS = { params: Promise.resolve({ id: 'school-1' }) };

const STUDENT = {
  userId: 'u1',
  name: 'Alice',
  email: 'alice@example.com',
  level: 'B1',
  progress: 0.6,
  lastSeen: '2026-05-20',
  enrolledAt: '2026-01-01',
  groups: [],
};

describe('GET /api/schools/[id]/students', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with the enriched student list', async () => {
    mockFetch.mockResolvedValue([STUDENT]);
    const req = new NextRequest('http://localhost/api/schools/school-1/students');
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].userId).toBe('u1');
    expect(body.total).toBe(1);
  });

  // getStudents() degrades gracefully on upstream failure (same contract as the
  // RSC page that also calls it) rather than propagating the upstream status —
  // a transient org-service hiccup should never crash the roster.
  it('returns 200 with an empty list when unauthenticated', async () => {
    const { AppError } = await import('@/lib/errors');
    mockFetch.mockRejectedValue(new AppError('unauthenticated', 'No token'));
    const req = new NextRequest('http://localhost/api/schools/school-1/students');
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
  });

  it('returns 200 with an empty list on upstream error', async () => {
    const { AppError } = await import('@/lib/errors');
    mockFetch.mockRejectedValue(new AppError('upstream_unavailable', 'Down'));
    const req = new NextRequest('http://localhost/api/schools/school-1/students');
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
  });
});

describe('POST /api/schools/[id]/students (enroll via invite)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 201 when invitation is created', async () => {
    mockFetch.mockResolvedValue({ id: 'inv-1' });
    const req = new NextRequest('http://localhost/api/schools/school-1/students', {
      method: 'POST',
      body: JSON.stringify({ email: 'new@example.com', role: 'STUDENT', kind: 'register' }),
    });
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(201);
  });

  it('returns 409 on conflict (duplicate invite)', async () => {
    const { AppError } = await import('@/lib/errors');
    mockFetch.mockRejectedValue(new AppError('conflict', 'Already invited'));
    const req = new NextRequest('http://localhost/api/schools/school-1/students', {
      method: 'POST',
      body: JSON.stringify({ email: 'dup@example.com', role: 'STUDENT', kind: 'register' }),
    });
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(409);
  });
});

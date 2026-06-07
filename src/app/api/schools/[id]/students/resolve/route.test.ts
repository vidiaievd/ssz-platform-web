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

const { GET } = await import('./route');
const { serverFetch } = await import('@/lib/api/server-fetcher');
const mockFetch = vi.mocked(serverFetch);

const PARAMS = { params: Promise.resolve({ id: 'school-1' }) };

function makeReq(email: string) {
  return new NextRequest(
    `http://localhost/api/schools/school-1/students/resolve?email=${encodeURIComponent(email)}`,
  );
}

describe('GET /api/schools/[id]/students/resolve', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns "register" when user is not found', async () => {
    const { AppError } = await import('@/lib/errors');
    mockFetch.mockRejectedValue(new AppError('not_found', 'User not found'));
    const res = await GET(makeReq('new@example.com'), PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.branch).toBe('register');
  });

  it('returns "attach-direct" when user has student role', async () => {
    mockFetch.mockResolvedValue({ userId: 'u1', displayName: 'Alice', roles: ['STUDENT'] });
    const res = await GET(makeReq('alice@example.com'), PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.branch).toBe('attach-direct');
    expect(body.userId).toBe('u1');
  });

  it('returns "onboard-existing" when user exists but has no student role', async () => {
    mockFetch.mockResolvedValue({ userId: 'u2', displayName: 'Bob', roles: ['TEACHER'] });
    const res = await GET(makeReq('bob@example.com'), PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.branch).toBe('onboard-existing');
  });

  it('returns 400 when email param is missing', async () => {
    const req = new NextRequest('http://localhost/api/schools/school-1/students/resolve');
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(400);
  });
});

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

  it('returns "register" when no account has the address', async () => {
    mockFetch.mockResolvedValue({ found: false });
    const res = await GET(makeReq('new@example.com'), PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.branch).toBe('register');
    // The school's own lookup, not a public one.
    expect(mockFetch).toHaveBeenCalledWith({
      service: 'organization',
      path: '/schools/school-1/users/lookup',
      query: { email: 'new@example.com' },
    });
  });

  it('returns "attach-direct" for a student', async () => {
    mockFetch.mockResolvedValue({ found: true, userId: 'u1', displayName: 'Alice', isStudent: true, isTeacher: false });
    const res = await GET(makeReq('alice@example.com'), PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.branch).toBe('attach-direct');
    expect(body.userId).toBe('u1');
  });

  it('returns "onboard-existing" for an account that is not a student', async () => {
    mockFetch.mockResolvedValue({ found: true, userId: 'u2', displayName: 'Bob', isStudent: false, isTeacher: true });
    const res = await GET(makeReq('bob@example.com'), PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.branch).toBe('onboard-existing');
  });

  it('never answers "register" on a failure: 429 over the limit, 502 otherwise', async () => {
    const { AppError } = await import('@/lib/errors');
    mockFetch.mockRejectedValueOnce(new AppError('rate_limited', 'Too many'));
    expect((await GET(makeReq('a@example.com'), PARAMS)).status).toBe(429);
    mockFetch.mockRejectedValueOnce(new AppError('upstream_unavailable', 'down'));
    expect((await GET(makeReq('a@example.com'), PARAMS)).status).toBe(502);
  });

  it('returns 400 when email param is missing', async () => {
    const req = new NextRequest('http://localhost/api/schools/school-1/students/resolve');
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(400);
  });
});

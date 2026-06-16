// @vitest-environment node

import { NextRequest } from 'next/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
  headers: async () => new Headers(),
}));

vi.mock('@/lib/api/server-fetcher', () => ({
  serverFetch: vi.fn(),
}));

const { POST } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';

const SCHOOL_ID = 'school-uuid-1234';
const MEMBERSHIP_ID = 'm1';
const GROUP_ID = 'group-b1';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/enrollment/memberships/${MEMBERSHIP_ID}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function params(membershipId: string) {
  return { params: Promise.resolve({ membershipId }) };
}

beforeEach(() => {
  vi.mocked(serverFetch).mockReset();
});

describe('POST /api/enrollment/memberships/[membershipId]/assign', () => {
  it('returns 400 when schoolId is missing', async () => {
    const res = await POST(makeRequest({ groupId: GROUP_ID }), params(MEMBERSHIP_ID));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/"schoolId"/);
  });

  it('returns 400 when groupId is missing', async () => {
    const res = await POST(makeRequest({ schoolId: SCHOOL_ID }), params(MEMBERSHIP_ID));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/"groupId"/);
  });

  it('returns 200 when backend call succeeds', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(undefined);
    const res = await POST(makeRequest({ schoolId: SCHOOL_ID, groupId: GROUP_ID }), params(MEMBERSHIP_ID));
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('returns 404 when backend returns not_found', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('not_found', 'Membership not found'));
    const res = await POST(makeRequest({ schoolId: SCHOOL_ID, groupId: GROUP_ID }), params('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('returns 409 when backend returns conflict', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('conflict', 'Already assigned'));
    const res = await POST(makeRequest({ schoolId: SCHOOL_ID, groupId: GROUP_ID }), params(MEMBERSHIP_ID));
    expect(res.status).toBe(409);
  });

  it('calls backend with correct path and groupId', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(undefined);
    await POST(makeRequest({ schoolId: SCHOOL_ID, groupId: GROUP_ID }), params(MEMBERSHIP_ID));
    const call = vi.mocked(serverFetch).mock.calls[0]![0] as { path: string; body: unknown };
    expect(call.path).toBe(`/schools/${SCHOOL_ID}/memberships/${MEMBERSHIP_ID}/assign-group`);
    expect(call.body).toEqual({ groupId: GROUP_ID });
  });
});

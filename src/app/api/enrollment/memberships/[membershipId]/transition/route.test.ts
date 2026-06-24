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

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/enrollment/memberships/${MEMBERSHIP_ID}/transition`, {
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

describe('POST /api/enrollment/memberships/[membershipId]/transition', () => {
  it('returns 400 when body is not valid JSON', async () => {
    const req = new NextRequest(
      `http://localhost/api/enrollment/memberships/${MEMBERSHIP_ID}/transition`,
      { method: 'POST', body: 'not-json' },
    );
    const res = await POST(req, params(MEMBERSHIP_ID));
    expect(res.status).toBe(400);
  });

  it('returns 400 when schoolId is missing', async () => {
    const res = await POST(makeRequest({ to: 'onboarding' }), params(MEMBERSHIP_ID));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/"schoolId"/);
  });

  it('returns 400 when "to" is missing', async () => {
    const res = await POST(makeRequest({ schoolId: SCHOOL_ID }), params(MEMBERSHIP_ID));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/"to"/);
  });

  it('calls /approve for pending → onboarding transition', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(undefined);
    const res = await POST(makeRequest({ schoolId: SCHOOL_ID, to: 'onboarding' }), params(MEMBERSHIP_ID));
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
    const call = vi.mocked(serverFetch).mock.calls[0]![0] as { path: string };
    expect(call.path).toContain('/approve');
  });

  it('calls /reject for the rejected transition', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(undefined);
    const res = await POST(makeRequest({ schoolId: SCHOOL_ID, to: 'rejected' }), params(MEMBERSHIP_ID));
    expect(res.status).toBe(200);
    const call = vi.mocked(serverFetch).mock.calls[0]![0] as { path: string };
    expect(call.path).toContain('/reject');
  });

  it('calls /complete for student-initiated transitions (placement-review)', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(undefined);
    const res = await POST(makeRequest({ schoolId: SCHOOL_ID, to: 'placement-review' }), params(MEMBERSHIP_ID));
    expect(res.status).toBe(200);
    const call = vi.mocked(serverFetch).mock.calls[0]![0] as { path: string };
    expect(call.path).toContain('/complete');
  });

  it('returns 400 for an active transition — active is only reachable via group assignment', async () => {
    const res = await POST(makeRequest({ schoolId: SCHOOL_ID, to: 'active' }), params(MEMBERSHIP_ID));
    expect(res.status).toBe(400);
    expect(vi.mocked(serverFetch)).not.toHaveBeenCalled();
  });

  it('returns 404 when backend returns not_found', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('not_found', 'Membership not found'));
    const res = await POST(makeRequest({ schoolId: SCHOOL_ID, to: 'onboarding' }), params('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('returns 409 when backend returns conflict', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('conflict', 'Already approved'));
    const res = await POST(makeRequest({ schoolId: SCHOOL_ID, to: 'onboarding' }), params(MEMBERSHIP_ID));
    expect(res.status).toBe(409);
  });
});

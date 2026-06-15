// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
  headers: async () => new Headers(),
}));

vi.mock('@/lib/enrollment/provider', async () => {
  const { mockProvider } = await import('@/lib/enrollment/mock');
  return { getEnrollmentProvider: () => mockProvider };
});

const { POST } = await import('./route');
const { mockProvider, resetMockStore } = await import('@/lib/enrollment/mock');

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/enrollment/memberships/m1/assign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function params(membershipId: string) {
  return { params: Promise.resolve({ membershipId }) };
}

beforeEach(() => {
  resetMockStore();
});

describe('POST /api/enrollment/memberships/[membershipId]/assign', () => {
  it('returns 400 when groupId is missing', async () => {
    const m = await mockProvider.createMembership({
      schoolSlug: 'oslo-language-school',
      source: 'public-apply',
      language: 'nb',
    });
    const res = await POST(makeRequest({}), params(m.id));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/"groupId"/);
  });

  it('returns 404 for an unknown membership ID', async () => {
    const res = await POST(makeRequest({ groupId: 'group-b1' }), params('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('returns 409 when membership is not in a state that allows assignment (pending)', async () => {
    const m = await mockProvider.createMembership({
      schoolSlug: 'oslo-language-school',
      source: 'public-apply',
      language: 'nb',
    });
    expect(m.status).toBe('pending');
    // Cannot assign from pending — must be in placement-review or onboarding
    const res = await POST(makeRequest({ groupId: 'group-b1' }), params(m.id));
    expect(res.status).toBe(409);
  });

  it('assigns placement-review membership to a group and transitions to active', async () => {
    const m = await mockProvider.createMembership({
      schoolSlug: 'oslo-language-school',
      source: 'public-apply',
      language: 'nb',
    });
    // Advance to placement-review via provider (simulating admin approval + onboarding completion)
    await mockProvider.transition(m.id, 'onboarding');
    await mockProvider.transition(m.id, 'placement-review');

    const res = await POST(makeRequest({ groupId: 'group-b1-mon' }), params(m.id));
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; groupId: string };
    expect(body.status).toBe('active');
    expect(body.groupId).toBe('group-b1-mon');
  });

  it('assigns open-school onboarding membership directly to active', async () => {
    // open-school auto-approves → starts at onboarding
    const m = await mockProvider.createMembership({
      schoolSlug: 'open-school',
      source: 'public-apply',
      language: 'nb',
    });
    expect(m.status).toBe('onboarding');

    const res = await POST(makeRequest({ groupId: 'group-a1-wed' }), params(m.id));
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; groupId: string };
    expect(body.status).toBe('active');
    expect(body.groupId).toBe('group-a1-wed');
  });
});

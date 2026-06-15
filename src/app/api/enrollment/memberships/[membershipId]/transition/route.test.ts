// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
  headers: async () => new Headers(),
}));

// Make the route handler use the same mockProvider instance as this test (avoids CJS/ESM split).
vi.mock('@/lib/enrollment/provider', async () => {
  const { mockProvider } = await import('@/lib/enrollment/mock');
  return { getEnrollmentProvider: () => mockProvider };
});

const { POST } = await import('./route');
const { mockProvider, resetMockStore } = await import('@/lib/enrollment/mock');

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/enrollment/memberships/m1/transition', {
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

describe('POST /api/enrollment/memberships/[membershipId]/transition', () => {
  it('returns 400 when body is missing the "to" field', async () => {
    const m = await mockProvider.createMembership({
      schoolSlug: 'oslo-language-school',
      source: 'public-apply',
      language: 'nb',
    });
    const res = await POST(makeRequest({}), params(m.id));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/"to"/);
  });

  it('returns 400 when body is not valid JSON', async () => {
    const req = new NextRequest(
      'http://localhost/api/enrollment/memberships/m1/transition',
      { method: 'POST', body: 'not-json' },
    );
    const m = await mockProvider.createMembership({
      schoolSlug: 'oslo-language-school',
      source: 'public-apply',
      language: 'nb',
    });
    const res = await POST(req, params(m.id));
    expect(res.status).toBe(400);
  });

  it('returns 409 for an invalid transition (pending → active)', async () => {
    const m = await mockProvider.createMembership({
      schoolSlug: 'oslo-language-school',
      source: 'public-apply',
      language: 'nb',
    });
    // pending → active is not in the allowed graph
    const res = await POST(makeRequest({ to: 'active' }), params(m.id));
    expect(res.status).toBe(409);
    const body = await res.json() as { error: string };
    expect(body.error).toBeTruthy();
  });

  it('returns 409 for rejected → onboarding', async () => {
    const m = await mockProvider.createMembership({
      schoolSlug: 'oslo-language-school',
      source: 'public-apply',
      language: 'nb',
    });
    await mockProvider.transition(m.id, 'rejected');
    const res = await POST(makeRequest({ to: 'onboarding' }), params(m.id));
    expect(res.status).toBe(409);
  });

  it('returns 404 for an unknown membership ID', async () => {
    const res = await POST(makeRequest({ to: 'onboarding' }), params('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('returns 200 and updated membership for pending → onboarding', async () => {
    const m = await mockProvider.createMembership({
      schoolSlug: 'oslo-language-school',
      source: 'public-apply',
      language: 'nb',
    });
    expect(m.status).toBe('pending');

    const res = await POST(makeRequest({ to: 'onboarding' }), params(m.id));
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('onboarding');
  });

  it('returns 200 for onboarding → placement-review', async () => {
    const m = await mockProvider.createMembership({
      schoolSlug: 'oslo-language-school',
      source: 'public-apply',
      language: 'nb',
    });
    await mockProvider.transition(m.id, 'onboarding');
    const res = await POST(makeRequest({ to: 'placement-review' }), params(m.id));
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('placement-review');
  });

  it('returns 200 for active → left', async () => {
    const m = await mockProvider.createMembership({
      schoolSlug: 'open-school',
      source: 'public-apply',
      language: 'nb',
    });
    // open-school auto-approves to onboarding
    expect(m.status).toBe('onboarding');
    await mockProvider.transition(m.id, 'active');

    const res = await POST(makeRequest({ to: 'left' }), params(m.id));
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('left');
  });
});

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

const { GET, PUT } = await import('./route');
const { resetMockStore } = await import('@/lib/enrollment/mock');
import { DEFAULT_ONBOARDING_SETTINGS } from '@/lib/enrollment/settings-defaults';

function getReq(): NextRequest {
  return new NextRequest('http://localhost/api/enrollment/schools/oslo-language-school/settings');
}

function putReq(body: unknown): NextRequest {
  return new NextRequest(
    'http://localhost/api/enrollment/schools/oslo-language-school/settings',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

function params(schoolSlug: string) {
  return { params: Promise.resolve({ schoolSlug }) };
}

beforeEach(() => {
  resetMockStore();
});

describe('GET /api/enrollment/schools/[schoolSlug]/settings', () => {
  it('returns 200 with fixture settings for oslo-language-school', async () => {
    const res = await GET(getReq(), params('oslo-language-school'));
    expect(res.status).toBe(200);
    const body = await res.json() as { placement: { mode: string } };
    expect(body.placement.mode).toBe('platform');
  });

  it('returns default settings for an unknown school', async () => {
    const req = new NextRequest('http://localhost/api/enrollment/schools/new-school/settings');
    const res = await GET(req, params('new-school'));
    expect(res.status).toBe(200);
    const body = await res.json() as typeof DEFAULT_ONBOARDING_SETTINGS;
    expect(body.placement.mode).toBe(DEFAULT_ONBOARDING_SETTINGS.placement.mode);
  });
});

describe('PUT /api/enrollment/schools/[schoolSlug]/settings', () => {
  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest(
      'http://localhost/api/enrollment/schools/oslo-language-school/settings',
      { method: 'PUT', body: 'bad json {{' },
    );
    const res = await PUT(req, params('oslo-language-school'));
    expect(res.status).toBe(400);
  });

  it('saves and returns merged settings', async () => {
    const patch = {
      placement: { mode: 'none', reusePlatformResult: false },
      interview: { required: false, autoPlaceByScore: false },
      availability: { collect: false },
      approval: { mode: 'auto' },
    };
    const res = await PUT(putReq(patch), params('oslo-language-school'));
    expect(res.status).toBe(200);
    const body = await res.json() as { placement: { mode: string }; approval: { mode: string } };
    expect(body.placement.mode).toBe('none');
    expect(body.approval.mode).toBe('auto');
  });

  it('subsequent GET returns the updated settings', async () => {
    await PUT(
      putReq({ approval: { mode: 'auto' } }),
      params('oslo-language-school'),
    );
    const res = await GET(getReq(), params('oslo-language-school'));
    const body = await res.json() as { approval: { mode: string } };
    expect(body.approval.mode).toBe('auto');
  });
});

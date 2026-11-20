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

// The school is found through the caller's workspace, by id or slug, in any lifecycle status.
const resolveSchoolWorkspace = vi.fn();
vi.mock('@/features/workspaces/api/resolve-school-workspace', () => ({
  resolveSchoolWorkspace: (idOrSlug: string) => resolveSchoolWorkspace(idOrSlug),
}));

const { GET, PUT } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';
import { DEFAULT_ONBOARDING_SETTINGS } from '@/lib/enrollment/settings-defaults';

const SCHOOL_ID = 'aaaabbbb-cccc-dddd-eeee-ffffffffffff';

const BASE_BACKEND_SETTINGS = {
  placementMode: 'platform',
  reusePlatform: false,
  interviewRequired: false,
  autoPlaceByScore: false,
  collectAvailability: false,
  approvalMode: 'manual',
};

function mockPublicSchool() {
  resolveSchoolWorkspace.mockResolvedValueOnce({
    id: SCHOOL_ID,
    kind: 'SCHOOL',
    name: 'Oslo Language School',
    slug: 'oslo-language-school',
    myRole: 'OWNER',
  });
}

function getReq(slug = 'oslo-language-school'): NextRequest {
  return new NextRequest(`http://localhost/api/enrollment/schools/${slug}/settings`);
}

function putReq(body: unknown, slug = 'oslo-language-school'): NextRequest {
  return new NextRequest(
    `http://localhost/api/enrollment/schools/${slug}/settings`,
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
  vi.mocked(serverFetch).mockReset();
  resolveSchoolWorkspace.mockReset().mockResolvedValue(null);
});

describe('GET /api/enrollment/schools/[schoolSlug]/settings', () => {
  it('returns 200 with mapped settings from backend', async () => {
    mockPublicSchool();
    vi.mocked(serverFetch).mockResolvedValueOnce({ ...BASE_BACKEND_SETTINGS, placementMode: 'platform' });

    const res = await GET(getReq(), params('oslo-language-school'));
    expect(res.status).toBe(200);
    const body = await res.json() as { placement: { mode: string } };
    expect(body.placement.mode).toBe('platform');
  });

  it('returns default settings when backend returns 404', async () => {
    mockPublicSchool();
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('not_found', 'Settings not found'));

    const res = await GET(getReq(), params('oslo-language-school'));
    expect(res.status).toBe(200);
    const body = await res.json() as typeof DEFAULT_ONBOARDING_SETTINGS;
    expect(body.placement.mode).toBe(DEFAULT_ONBOARDING_SETTINGS.placement.mode);
  });
});

describe('the school behind the address (plan 90, live check, session 12)', () => {
  it('reads the settings of a school addressed by its uuid', async () => {
    mockPublicSchool();
    vi.mocked(serverFetch).mockResolvedValueOnce({ ...BASE_BACKEND_SETTINGS, approvalMode: 'auto' });

    const res = await GET(getReq(SCHOOL_ID), params(SCHOOL_ID));

    expect(res.status).toBe(200);
    expect(resolveSchoolWorkspace).toHaveBeenCalledWith(SCHOOL_ID);
    const call = vi.mocked(serverFetch).mock.calls[0]![0] as { path: string };
    expect(call.path).toBe(`/schools/${SCHOOL_ID}/enrollment/settings`);
  });

  it('answers 404 for a school that is not the caller\'s, instead of defaults', async () => {
    const res = await GET(getReq('elsewhere'), params('elsewhere'));
    expect(res.status).toBe(404);
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it('saves nothing for a school that is not the caller\'s', async () => {
    const res = await PUT(putReq({ approval: { mode: 'auto' } }, 'elsewhere'), params('elsewhere'));
    expect(res.status).toBe(404);
    expect(serverFetch).not.toHaveBeenCalled();
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

  it('saves and returns merged settings from backend response', async () => {
    mockPublicSchool();
    vi.mocked(serverFetch).mockResolvedValueOnce({
      ...BASE_BACKEND_SETTINGS,
      placementMode: 'none',
      approvalMode: 'auto',
    });

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

  it('calls backend with correct field mapping', async () => {
    mockPublicSchool();
    vi.mocked(serverFetch).mockResolvedValueOnce({
      ...BASE_BACKEND_SETTINGS,
      collectAvailability: true,
      approvalMode: 'manual',
    });

    await PUT(
      putReq({ availability: { collect: true }, approval: { mode: 'manual' } }),
      params('oslo-language-school'),
    );

    const lastCall = vi.mocked(serverFetch).mock.calls.at(-1)![0] as { body: Record<string, unknown> };
    expect(lastCall.body.collectAvailability).toBe(true);
    expect(lastCall.body.approvalMode).toBe('manual');
  });
});

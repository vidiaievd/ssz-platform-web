// @vitest-environment node

import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));
vi.mock('@/features/school/api/resolve-school-id', () => ({ resolveSchoolId: vi.fn() }));
vi.mock('@/features/review/lib/review-scope', () => ({ resolveOversightAccess: vi.fn() }));

const { GET, PUT } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { resolveSchoolId } from '@/features/school/api/resolve-school-id';
import { resolveOversightAccess } from '@/features/review/lib/review-scope';
import { AppError } from '@/lib/errors';

const SCHOOL_ID = '22222222-2222-4222-8222-222222222222';
const MINUTES = {
  templates: [
    { templateCode: 'read_aloud', minutes: 7, source: 'school' },
    { templateCode: 'writing_task', minutes: 12, source: 'default' },
  ],
  other: { minutes: 3, source: 'default' },
};
const ENGINE = {
  pending: [],
  norms: [
    { templateCode: 'read_aloud', minutesPerSubmission: 7, source: 'school', sampleSize: 6 },
    { templateCode: 'writing_task', minutesPerSubmission: 9.5, source: 'history', sampleSize: 31 },
  ],
  historyDays: 90,
  minSample: 20,
};

const params = { params: Promise.resolve({ id: 'nordick' }) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveSchoolId).mockResolvedValue(SCHOOL_ID);
  vi.mocked(resolveOversightAccess).mockResolvedValue({
    schoolId: SCHOOL_ID,
    userId: 'owner',
    role: 'OWNER',
  });
});

describe('/api/schools/:id/review-effort', () => {
  it("puts the school's medians beside its figures, only where the engine trusts them", async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(MINUTES).mockResolvedValueOnce(ENGINE);

    const response = await GET(new NextRequest('http://localhost/x'), params);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ...MINUTES,
      measured: {
        historyDays: 90,
        minSample: 20,
        templates: [
          { templateCode: 'read_aloud', sampleSize: 6, medianMinutes: null },
          { templateCode: 'writing_task', sampleSize: 31, medianMinutes: 9.5 },
        ],
      },
    });
    expect(serverFetch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        service: 'exercises',
        path: '/internal/attempts/review/effort',
        query: { schoolId: SCHOOL_ID },
        anonymous: true,
      }),
    );
  });

  it('does not ask the engine for somebody who does not oversee the school', async () => {
    vi.mocked(resolveOversightAccess).mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    );
    vi.mocked(serverFetch).mockResolvedValueOnce(MINUTES);

    const response = await GET(new NextRequest('http://localhost/x'), params);

    expect(response.status).toBe(200);
    expect((await response.json()).measured).toBeNull();
    expect(serverFetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the figures when the measurements cannot be read', async () => {
    vi.mocked(serverFetch)
      .mockResolvedValueOnce(MINUTES)
      .mockRejectedValueOnce(new AppError('upstream_unavailable', 'engine down'));

    const response = await GET(new NextRequest('http://localhost/x'), params);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.templates).toEqual(MINUTES.templates);
    expect(body.measured).toBeNull();
  });

  it('passes a refused write on with its status', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('forbidden', 'Upstream 403'));

    const response = await PUT(
      new NextRequest('http://localhost/x', {
        method: 'PUT',
        body: JSON.stringify({ templates: { read_aloud: 7 }, other: null }),
      }),
      params,
    );

    expect(response.status).toBe(403);
    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'organization',
        path: `/schools/${SCHOOL_ID}/review-effort`,
        method: 'PUT',
        body: { templates: { read_aloud: 7 }, other: null },
      }),
    );
  });
});

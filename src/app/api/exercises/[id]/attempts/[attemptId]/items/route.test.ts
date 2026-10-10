// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { POST } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

const PROBE = {
  n: 3,
  total: 12,
  questionId: 'p3',
  clip: {
    url: 'https://media.test/a.mp3',
    expiresAt: '2026-10-09T12:00:00.000Z',
    durationMs: 780,
    provenance: 'tts',
    dialect: '',
  },
  options: [{ id: 'w1' }, { id: 'w2' }],
  state: { tries: 0, maxTries: 2, closed: false },
  closedProbes: [
    { n: 1, correct: true },
    { n: 2, correct: false },
  ],
};

const request = () =>
  new NextRequest('http://localhost/api/exercises/ex-1/attempts/att-1/items', { method: 'POST' });

const params = Promise.resolve({ id: 'ex-1', attemptId: 'att-1' });

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('POST /api/exercises/[id]/attempts/[attemptId]/items', () => {
  it('hands the probe through as the engine dealt it, with no body sent up', async () => {
    vi.mocked(serverFetch).mockResolvedValue(PROBE);

    const res = await POST(request(), { params });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(PROBE);
    expect(serverFetch).toHaveBeenCalledWith({
      service: 'exercises',
      path: '/exercises/ex-1/attempts/att-1/items',
      method: 'POST',
    });
  });

  it('maps the errors the caller can act on', async () => {
    const cases: Array<[string, number]> = [
      ['unauthenticated', 401],
      ['forbidden', 403],
      ['not_found', 404],
    ];
    for (const [code, status] of cases) {
      vi.mocked(serverFetch).mockRejectedValueOnce(new AppError(code as 'not_found', 'nope'));
      const res = await POST(request(), { params });
      expect(res.status).toBe(status);
    }
  });

  it('says when every probe is closed — the sitting waits for its submit', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(
      new AppError('validation', 'closed', { message: 'All closed', code: 'ALL_PROBES_CLOSED' }),
    );
    const res = await POST(request(), { params });

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({ code: 'ALL_PROBES_CLOSED' });
  });

  it('keeps a clip that cannot be signed apart from a broken upstream', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(
      new AppError('upstream_unavailable', 'media', { code: 'MEDIA_UNAVAILABLE' }),
    );
    const unsigned = await POST(request(), { params });
    expect(unsigned.status).toBe(503);
    await expect(unsigned.json()).resolves.toMatchObject({ code: 'MEDIA_UNAVAILABLE' });

    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('upstream_unavailable', 'down'));
    const broken = await POST(request(), { params });
    expect(broken.status).toBe(502);
  });
});

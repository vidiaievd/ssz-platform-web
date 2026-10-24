// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { POST } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

const params = Promise.resolve({ id: 'ex-1', attemptId: 'att-1' });

function makeRequest(body?: unknown) {
  return new NextRequest('http://localhost/api/exercises/ex-1/attempts/att-1/ai-review/dispute', {
    method: 'POST',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeEach(() => {
  vi.mocked(serverFetch).mockReset();
  vi.mocked(serverFetch).mockResolvedValue({ disputedAt: '2026-10-24T12:00:00.000Z' });
});

describe('POST /api/exercises/[id]/attempts/[attemptId]/ai-review/dispute', () => {
  it('passes a trimmed reason on and answers with the time of the dispute', async () => {
    const res = await POST(makeRequest({ reason: '  Setning 2 er riktig.  ' }), { params });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ disputedAt: '2026-10-24T12:00:00.000Z' });
    expect(serverFetch).toHaveBeenCalledWith({
      service: 'exercises',
      path: '/exercises/ex-1/attempts/att-1/ai-review/dispute',
      method: 'POST',
      body: { reason: 'Setning 2 er riktig.' },
    });
  });

  it('sends no reason at all for an empty box or no body', async () => {
    await POST(makeRequest({ reason: '   ' }), { params });
    await POST(makeRequest(), { params });

    for (const call of vi.mocked(serverFetch).mock.calls) {
      expect(call[0]).toMatchObject({ body: {} });
    }
  });

  it('refuses a reason longer than the engine keeps, without calling it', async () => {
    const res = await POST(makeRequest({ reason: 'x'.repeat(1001) }), { params });

    expect(res.status).toBe(400);
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it('maps the engine’s refusals', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(
      new AppError('not_found', 'nope', { code: 'NO_AI_REVIEW' }),
    );
    const none = await POST(makeRequest({}), { params });
    expect(none.status).toBe(404);
    await expect(none.json()).resolves.toMatchObject({ code: 'NO_AI_REVIEW' });

    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('unauthenticated', 'nope'));
    expect((await POST(makeRequest({}), { params })).status).toBe(401);

    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('boom'));
    expect((await POST(makeRequest({}), { params })).status).toBe(502);
  });
});

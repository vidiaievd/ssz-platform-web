// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { POST } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

const LOOKUP = {
  lessonId: 'lesson-1',
  lessonVariantId: 'variant-1',
  vocabularyItemId: 'vocab-1',
  level: 'full',
  occurredAt: '2026-07-31T09:14:22.031Z',
};

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/learning/lookups', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('POST /api/learning/lookups', () => {
  it('forwards the batch and answers 202 with no body', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(undefined);

    const res = await POST(makeRequest({ lookups: [LOOKUP] }));

    expect(res.status).toBe(202);
    expect(await res.text()).toBe('');
    expect(serverFetch).toHaveBeenCalledWith({
      service: 'progress',
      path: '/lookups',
      method: 'POST',
      body: { lookups: [LOOKUP] },
    });
  });

  it('rejects a batch over the cap without calling upstream', async () => {
    const res = await POST(makeRequest({ lookups: Array.from({ length: 51 }, () => LOOKUP) }));

    expect(res.status).toBe(400);
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it('rejects an entry with an unknown level', async () => {
    const res = await POST(makeRequest({ lookups: [{ ...LOOKUP, level: 'peek' }] }));

    expect(res.status).toBe(400);
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it('rejects an empty batch', async () => {
    const res = await POST(makeRequest({ lookups: [] }));

    expect(res.status).toBe(400);
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON', async () => {
    const request = new NextRequest('http://localhost/api/learning/lookups', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    });

    expect((await POST(request)).status).toBe(400);
  });

  it('maps an unauthenticated upstream to 401', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('unauthenticated', 'No session'));

    expect((await POST(makeRequest({ lookups: [LOOKUP] }))).status).toBe(401);
  });

  it('returns 502 on upstream failure', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('network error'));

    expect((await POST(makeRequest({ lookups: [LOOKUP] }))).status).toBe(502);
  });
});

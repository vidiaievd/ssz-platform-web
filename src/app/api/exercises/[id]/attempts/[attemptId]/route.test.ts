// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

function makeRequest() {
  return new NextRequest('http://localhost/api/exercises/ex-1/attempts/att-1');
}

const params = Promise.resolve({ id: 'ex-1', attemptId: 'att-1' });

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('GET /api/exercises/[id]/attempts/[attemptId]', () => {
  it('returns only the status', async () => {
    vi.mocked(serverFetch).mockResolvedValue({
      status: 'ROUTED_FOR_REVIEW',
      submittedAnswer: { text: 'the actual answer' },
      validationDetails: { reference: 'do not leak me' },
    });

    const res = await GET(makeRequest(), { params });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'ROUTED_FOR_REVIEW' });
    expect(serverFetch).toHaveBeenCalledWith({
      service: 'exercises',
      path: '/exercises/ex-1/attempts/att-1',
      method: 'GET',
    });
  });

  it('never forwards the answer or the validator output, whatever the engine sends', async () => {
    vi.mocked(serverFetch).mockResolvedValue({
      status: 'SCORED',
      submittedAnswer: 'secret',
      validationDetails: { rules: ['nope'] },
    });

    const res = await GET(makeRequest(), { params });
    const payload = JSON.stringify(await res.json());

    expect(payload).not.toContain('secret');
    expect(payload).not.toContain('rules');
  });

  it('maps the errors the caller can act on', async () => {
    const cases: Array<[string, number]> = [
      ['unauthenticated', 401],
      ['forbidden', 404],
      ['not_found', 404],
    ];
    for (const [code, status] of cases) {
      vi.mocked(serverFetch).mockRejectedValueOnce(new AppError(code as 'not_found', 'nope'));
      const res = await GET(makeRequest(), { params });
      expect(res.status).toBe(status);
    }
  });

  it('does not report a failed check as any particular status', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('socket hang up'));
    const res = await GET(makeRequest(), { params });
    expect(res.status).toBe(502);
  });
});

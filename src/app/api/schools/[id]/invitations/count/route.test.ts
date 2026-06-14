// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/invitations/provider', () => ({
  getInvitationsProvider: vi.fn(),
}));

const { GET } = await import('./route');
const { getInvitationsProvider } = await import('@/lib/invitations/provider');
const mockGetProvider = vi.mocked(getInvitationsProvider);

function makeReq(query: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/schools/s1/invitations/count');
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

const PARAMS = { params: Promise.resolve({ id: 's1' }) };

describe('GET /api/schools/[id]/invitations/count', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns { count } from provider', async () => {
    const provider = { count: vi.fn().mockResolvedValue(3) };
    mockGetProvider.mockReturnValue(provider as never);

    const res = await GET(makeReq({ status: 'pending', role: 'TEACHER' }), PARAMS);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ count: 3 });
    expect(provider.count).toHaveBeenCalledWith('s1', { status: 'pending', role: 'TEACHER' });
  });

  it('passes undefined for absent query params', async () => {
    const provider = { count: vi.fn().mockResolvedValue(0) };
    mockGetProvider.mockReturnValue(provider as never);

    await GET(makeReq(), PARAMS);

    expect(provider.count).toHaveBeenCalledWith('s1', { status: undefined, role: undefined });
  });

  it('returns 502 when provider throws', async () => {
    const provider = { count: vi.fn().mockRejectedValue(new Error('upstream down')) };
    mockGetProvider.mockReturnValue(provider as never);

    const res = await GET(makeReq(), PARAMS);

    expect(res.status).toBe(502);
  });
});

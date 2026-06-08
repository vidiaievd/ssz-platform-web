// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/scheduling/provider', () => ({
  getSchedulingProvider: vi.fn(),
}));

const { POST } = await import('./route');
const { getSchedulingProvider } = await import('@/lib/scheduling/provider');
const mockGetProvider = vi.mocked(getSchedulingProvider);

const PARAMS = { params: Promise.resolve({ id: 'school-1', requestId: 'req-1' }) };

describe('POST /api/schools/[id]/scheduling/substitutions/[requestId]/assign', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 when substitute is successfully assigned', async () => {
    mockGetProvider.mockReturnValue({
      assignSubstitute: vi.fn().mockResolvedValue({ ok: true }),
    } as never);

    const req = new NextRequest(
      'http://localhost/api/schools/school-1/scheduling/substitutions/req-1/assign',
      {
        method: 'POST',
        body: JSON.stringify({ substituteTeacherId: 't2' }),
      },
    );
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('returns 409 when capacity is exceeded without override', async () => {
    mockGetProvider.mockReturnValue({
      assignSubstitute: vi.fn().mockResolvedValue({ ok: false, error: 'cap_exceeded' }),
    } as never);

    const req = new NextRequest(
      'http://localhost/api/schools/school-1/scheduling/substitutions/req-1/assign',
      {
        method: 'POST',
        body: JSON.stringify({ substituteTeacherId: 't2' }),
      },
    );
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('cap_exceeded');
  });

  it('passes override=true to assignSubstitute', async () => {
    const mockAssign = vi.fn().mockResolvedValue({ ok: true });
    mockGetProvider.mockReturnValue({
      assignSubstitute: mockAssign,
    } as never);

    const req = new NextRequest(
      'http://localhost/api/schools/school-1/scheduling/substitutions/req-1/assign',
      {
        method: 'POST',
        body: JSON.stringify({ substituteTeacherId: 't2', override: true }),
      },
    );
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(200);
    expect(mockAssign).toHaveBeenCalledWith('req-1', 't2', true);
  });

  it('returns 400 when substituteTeacherId is missing', async () => {
    mockGetProvider.mockReturnValue({ assignSubstitute: vi.fn() } as never);

    const req = new NextRequest(
      'http://localhost/api/schools/school-1/scheduling/substitutions/req-1/assign',
      {
        method: 'POST',
        body: JSON.stringify({ override: false }), // no substituteTeacherId
      },
    );
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(400);
  });

  it('returns 400 on malformed JSON', async () => {
    mockGetProvider.mockReturnValue({ assignSubstitute: vi.fn() } as never);

    const req = new NextRequest(
      'http://localhost/api/schools/school-1/scheduling/substitutions/req-1/assign',
      { method: 'POST', body: '{{bad json' },
    );
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(400);
  });
});

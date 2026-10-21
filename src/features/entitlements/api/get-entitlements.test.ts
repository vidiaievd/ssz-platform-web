// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { getEntitlements } = await import('./get-entitlements');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';

const RIGHTS = {
  account: { type: 'workspace', externalId: 'f17c0fb5-0000-4000-8000-000000000000' },
  source: 'subscription',
  plan: { code: 'tutor_pro', name: 'Tutor Pro', version: 1 },
  subscription: null,
  features: { 'ai.review_draft': { enabled: true, monthlyCredits: '1000', limits: {} } },
  periodStart: '2026-10-21T00:00:00.000Z',
  periodEnd: '2026-11-21T00:00:00.000Z',
  validUntil: '2026-11-20T00:00:00.000Z',
  version: 2,
};

beforeEach(() => {
  vi.mocked(serverFetch).mockReset();
});

describe('getEntitlements', () => {
  it("asks for the workspace's rights when given its id", async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(RIGHTS);

    const result = await getEntitlements('f17c0fb5-0000-4000-8000-000000000000');

    expect(result).toEqual(RIGHTS);
    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'subscription',
        path: '/subscriptions/me',
        query: { workspaceId: 'f17c0fb5-0000-4000-8000-000000000000' },
      }),
    );
  });

  it("asks for the person's own rights without an id", async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce({
      ...RIGHTS,
      account: { type: 'user', externalId: 'u1' },
    });

    await getEntitlements();

    const call = vi.mocked(serverFetch).mock.calls[0]![0];
    expect(call.query).toBeUndefined();
  });

  it('answers null when the caller is not a member', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('forbidden', 'not a member'));

    expect(await getEntitlements('w-other')).toBeNull();
  });

  it('answers null when subscription-service is down', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('upstream_unavailable', 'down'));

    expect(await getEntitlements('w-down')).toBeNull();
  });
});

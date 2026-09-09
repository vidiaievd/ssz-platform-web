// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const ENV = {
  ANALYTICS_SERVICE_INTERNAL_URL: 'http://analytics:3008',
  INTERNAL_SERVICE_TOKEN: 't',
};
vi.mock('@/lib/env', () => ({ env: ENV }));

const { getMasteryProfile } = await import('./get-mastery-profile');
import { serverFetch } from '@/lib/api/server-fetcher';

const PROFILE = {
  userId: 'u1',
  courseId: null,
  minWeightedSample: 8,
  weakest: [
    {
      skill: 'reading',
      focus: 'unknown',
      successRateEwma: 0.42,
      meanStability: 3.5,
      medianSecondsPerItem: null,
      attempts: 14,
      weightedSample: 9.2,
      lastAttemptAt: '2026-09-02T10:00:00.000Z',
    },
  ],
  insufficient: [
    {
      skill: 'listening',
      focus: 'unknown',
      status: 'insufficient_data',
      attempts: 2,
      weightedSample: 1.3,
      shortfall: 6.7,
    },
  ],
};

beforeEach(() => {
  vi.mocked(serverFetch).mockReset();
  ENV.ANALYTICS_SERVICE_INTERNAL_URL = 'http://analytics:3008';
  ENV.INTERNAL_SERVICE_TOKEN = 't';
});

describe('getMasteryProfile', () => {
  it('calls the guarded route directly, with the internal token', async () => {
    vi.mocked(serverFetch).mockResolvedValue(PROFILE);

    await getMasteryProfile('u1', { courseId: 'c1' });

    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'analytics',
        path: '/internal/mastery/u1',
        directBaseUrl: 'http://analytics:3008',
        headers: { 'x-internal-token': 't' },
        anonymous: true,
        query: expect.objectContaining({ courseId: 'c1' }),
      }),
    );
  });

  it('returns both lists as analytics ordered them', async () => {
    vi.mocked(serverFetch).mockResolvedValue(PROFILE);

    const profile = await getMasteryProfile('u1');

    expect(profile?.weakest).toHaveLength(1);
    expect(profile?.insufficient[0]?.shortfall).toBe(6.7);
    expect(profile?.minWeightedSample).toBe(8);
  });

  it('degrades to null — not to an empty profile — when the call fails', async () => {
    // An empty profile is a claim about the learner; a failed call must not make it.
    vi.mocked(serverFetch).mockRejectedValue(new Error('boom'));

    expect(await getMasteryProfile('u1')).toBeNull();
  });

  it('degrades to null when the shape changes upstream', async () => {
    vi.mocked(serverFetch).mockResolvedValue({ userId: 'u1', weakest: 'all of them' });

    expect(await getMasteryProfile('u1')).toBeNull();
  });

  it('does not call anything when the internal route is not configured', async () => {
    ENV.ANALYTICS_SERVICE_INTERNAL_URL = '';

    expect(await getMasteryProfile('u1')).toBeNull();
    expect(serverFetch).not.toHaveBeenCalled();
  });
});

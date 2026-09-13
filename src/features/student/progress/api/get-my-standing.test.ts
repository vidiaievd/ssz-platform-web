// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const ENV = {
  ORGANIZATION_SERVICE_INTERNAL_URL: 'http://organization:3002',
  INTERNAL_SERVICE_TOKEN: 't',
};
vi.mock('@/lib/env', () => ({ env: ENV }));

const { getMyStanding } = await import('./get-my-standing');
import { serverFetch } from '@/lib/api/server-fetcher';

const CONTEXT = {
  schoolId: 's1',
  groupId: 'g1',
  groupName: 'NO-A2-2026',
  showGroupPositionToStudents: true,
};

const POSITION = {
  own: 62,
  groupMedian: 71,
  percentile: 34,
  lowerThan: 2,
  band: 'below' as const,
  measured: 5,
};

/** Answers the context call first and the position call second, as the function asks. */
function answer(context: unknown, position?: unknown) {
  vi.mocked(serverFetch)
    .mockResolvedValueOnce(context as never)
    .mockResolvedValueOnce(position as never);
}

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('getMyStanding', () => {
  it('hands the learner a band and drops every number on the way', async () => {
    answer(CONTEXT, POSITION);

    const standing = await getMyStanding('u1');

    expect(standing).toEqual({ band: 'below', groupName: 'NO-A2-2026' });
    // The rank never leaves the server: a client that receives a percentile and declines
    // to draw it has still been handed it.
    expect(JSON.stringify(standing)).not.toContain('34');
    expect(JSON.stringify(standing)).not.toContain('71');
  });

  it('says nothing when the school turned the sentence off', async () => {
    answer({ ...CONTEXT, showGroupPositionToStudents: false });

    expect(await getMyStanding('u1')).toBeNull();
    // And does not go on to ask analytics about a learner it may not report on.
    expect(serverFetch).toHaveBeenCalledTimes(1);
  });

  it('says nothing for a learner in no group', async () => {
    answer({ schoolId: 's1', groupId: null, groupName: null, showGroupPositionToStudents: true });

    expect(await getMyStanding('u1')).toBeNull();
    expect(serverFetch).toHaveBeenCalledTimes(1);
  });

  it('treats "no scale in this group" as no position, not as a bottom place', async () => {
    // The endpoint answers with an empty body, which arrives as `undefined`.
    answer(CONTEXT, undefined);

    expect(await getMyStanding('u1')).toBeNull();
  });

  it('stays silent when either service cannot be asked', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('down'));
    expect(await getMyStanding('u1')).toBeNull();

    vi.mocked(serverFetch).mockReset();
    vi.mocked(serverFetch)
      .mockResolvedValueOnce(CONTEXT as never)
      .mockRejectedValueOnce(new Error('down'));
    expect(await getMyStanding('u1')).toBeNull();
  });
});

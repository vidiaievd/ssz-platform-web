// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./server-fetcher', () => ({ serverFetch: vi.fn() }));

const { fetchProfileSummaries } = await import('./profile-directory');
import { serverFetch } from './server-fetcher';

const profile = (userId: string) => ({ userId, displayName: `Name ${userId}` });

/** The comma-joined ids one lookup asked about. */
const askedIds = (args: unknown) => (args as { query: { userIds: string } }).query.userIds;

function idsAsked() {
  return vi.mocked(serverFetch).mock.calls.map(([args]) => askedIds(args));
}

describe('fetchProfileSummaries', () => {
  beforeEach(() => vi.mocked(serverFetch).mockReset());

  it('asks once for a page full of repeated ids', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce([profile('u1'), profile('u2')]);

    const names = await fetchProfileSummaries(['u1', 'u2', 'u1']);

    expect(idsAsked()).toEqual(['u1,u2']);
    expect(names.u1?.displayName).toBe('Name u1');
  });

  it('splits a set larger than the directory will answer for', async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `u${i}`);
    const answer = (args: unknown) => Promise.resolve(askedIds(args).split(',').map(profile));
    vi.mocked(serverFetch).mockImplementationOnce(answer).mockImplementationOnce(answer);

    const names = await fetchProfileSummaries(ids);

    // The lookup takes 100 ids at a time; asking for 150 in one call returns nothing.
    expect(idsAsked()).toHaveLength(2);
    expect(Object.keys(names)).toHaveLength(150);
  });

  it('leaves unresolved ids out rather than failing the caller', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('directory down'));

    const names = await fetchProfileSummaries(['u1']);

    // A queue without names is still a queue; a queue that will not open is a learner
    // left waiting on a teacher who cannot see their work.
    expect(names).toEqual({});
  });

  it('does not go looking when there is nobody to name', async () => {
    expect(await fetchProfileSummaries([])).toEqual({});
    expect(serverFetch).not.toHaveBeenCalled();
  });
});

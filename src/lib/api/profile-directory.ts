import 'server-only';

import { serverFetch } from './server-fetcher';

export interface ProfileSummary {
  userId: string;
  displayName: string;
  avatarUrl?: string;
}

/** user-profile-service takes at most this many ids in one lookup. */
const BATCH_SIZE = 100;

/**
 * Names for a page of user ids, keyed by id.
 *
 * The join happens in the BFF rather than in the service that produced the ids, because
 * names belong to profiles: content-service and exercise-engine hold user ids and nothing
 * else, and a service that copied a display name would be serving a stale one the day
 * someone marries.
 *
 * A failure here is never a failure of the screen that asked. A marking queue without
 * names is still a marking queue; a marking queue that would not open because the
 * directory blinked is a learner left waiting. Unresolved ids are simply absent from the
 * map, and the caller decides what to show instead.
 */
export async function fetchProfileSummaries(
  userIds: string[],
): Promise<Record<string, ProfileSummary>> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return {};

  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    batches.push(ids.slice(i, i + BATCH_SIZE));
  }

  const results = await Promise.all(
    batches.map(async (batch) => {
      try {
        return await serverFetch<ProfileSummary[]>({
          service: 'profile',
          path: '/profiles',
          query: { userIds: batch.join(',') },
        });
      } catch {
        return [];
      }
    }),
  );

  const byId: Record<string, ProfileSummary> = {};
  for (const profile of results.flat()) {
    byId[profile.userId] = profile;
  }
  return byId;
}

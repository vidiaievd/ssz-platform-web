import { keyFactory } from '@/lib/query/keys';

import type { MySubmissionsFilter } from '../types';

/**
 * Keyed by the filter because a filter *is* a different list, not a stale version of one:
 * sharing a key would show what was marked under the heading "waiting" for as long as the
 * fetch takes.
 */
export const mySubmissionsKeys = keyFactory('my-submissions', {
  list: (status: MySubmissionsFilter) => ['list', status] as const,
  lists: () => ['list'] as const,
});

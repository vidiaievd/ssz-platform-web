import 'server-only';

import { resolveWorkspace } from '@/features/workspaces/api/resolve-workspace';
import type { SchoolRole } from '../types';

/**
 * The current user's role in one workspace, by id or slug. Null when it is not theirs.
 *
 * Asked of the server rather than of "my schools", because that list is a school list: a
 * private tutor's own workspace is deliberately absent from it, and answering from it gave
 * a tutor standing in their own space the role of a `teacher` — enough to hide the danger
 * zone and half the course settings from the person who owns the course (plan 61).
 */
export async function getMySchoolRole(schoolSlug: string): Promise<SchoolRole | null> {
  const workspace = await resolveWorkspace(schoolSlug);
  return workspace?.myRole ?? null;
}

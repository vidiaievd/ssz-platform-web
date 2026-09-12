import 'server-only';

import { cache } from 'react';

import { serverFetch } from '@/lib/api/server-fetcher';

export interface TutorWorkspace {
  /**
   * The workspace the tutor owns. It is a school row of kind SOLO on the server, which
   * is how assignments, review and analytics can answer questions about a tutor's
   * learners at all — but it is never called a school anywhere the tutor can read.
   */
  schoolId: string;
  /** The single group the tutor's learners belong to. */
  groupId: string | null;
  name: string;
  studentCount: number;
}

/**
 * Where the signed-in tutor's own workspace lives. The server provisions one on the
 * spot for a tutor who registered before workspaces existed, so this only returns
 * null when the request itself failed.
 */
export const getTutorWorkspace = cache(async function (): Promise<TutorWorkspace | null> {
  try {
    return await serverFetch<TutorWorkspace>({
      service: 'organization',
      path: '/tutoring/workspace',
    });
  } catch (err) {
    console.error('[tutoring] getTutorWorkspace failed:', err);
    return null;
  }
});

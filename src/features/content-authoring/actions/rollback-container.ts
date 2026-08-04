'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { tryAction } from '@/lib/result';

/**
 * Puts a superseded version back on air. Students see it immediately — this is
 * a publish, not a staging step, and the author's draft is left alone.
 */
export async function rollbackContainerAction(containerId: string, versionId: string) {
  return tryAction(async () => {
    await serverFetch({
      service: 'content',
      path: `/containers/${containerId}/versions/${versionId}/rollback`,
      method: 'POST',
    });
    revalidatePath(`/school/content/${containerId}`);
    revalidatePath('/school/content');
  });
}

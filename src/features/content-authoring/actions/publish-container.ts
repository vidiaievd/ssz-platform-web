'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { tryAction } from '@/lib/result';
import { requireDraftVersionId } from '@/features/content-authoring/lib/container-items';

export async function publishContainerAction(containerId: string) {
  return tryAction(async () => {
    const versionId = await requireDraftVersionId(containerId);
    await serverFetch({
      service: 'content',
      path: `/containers/${containerId}/versions/${versionId}/publish`,
      method: 'POST',
    });
    revalidatePath(`/school/content/${containerId}`);
    revalidatePath('/school/content');
  });
}

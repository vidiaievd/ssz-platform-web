'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { tryAction } from '@/lib/result';

export async function publishContainerAction(containerId: string) {
  return tryAction(async () => {
    await serverFetch({
      service: 'content',
      path: `/api/v1/containers/${containerId}/publish`,
      method: 'POST',
    });
    revalidatePath(`/school/content/${containerId}`);
    revalidatePath('/school/content');
  });
}

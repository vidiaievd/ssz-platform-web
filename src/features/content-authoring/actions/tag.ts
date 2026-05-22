'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';
import type { ContentTag } from '@/features/content/types';

export async function addTagAction(entityType: string, entityId: string, name: string) {
  return tryAction(async () => {
    const trimmed = name.trim();
    if (!trimmed) throw new AppError('validation', 'Tag name is required');

    const tag = await serverFetch<ContentTag>({
      service: 'content',
      path: '/api/v1/tags',
      method: 'POST',
      body: { entityType, entityId, name: trimmed },
    });

    if (entityType === 'container') revalidatePath(`/school/content/${entityId}`);
    return tag;
  });
}

export async function removeTagAction(tagId: string, entityType: string, entityId: string) {
  return tryAction(async () => {
    await serverFetch({
      service: 'content',
      path: `/api/v1/tags/${tagId}`,
      method: 'DELETE',
    });

    if (entityType === 'container') revalidatePath(`/school/content/${entityId}`);
  });
}

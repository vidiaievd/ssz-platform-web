'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';

import { RENAMABLE_ITEM_PATHS, type RenamableItemType } from '../lib/renamable-item';

/**
 * Renames the entity a curriculum row points at, without touching anything else
 * about it — the inline rename in the structure tree.
 *
 * @param containerId the container being edited, for cache revalidation only.
 */
export async function renameItemAction(
  itemType: RenamableItemType,
  refId: string,
  containerId: string,
  title: string,
) {
  return tryAction(async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      throw new AppError('validation', 'Invalid input', { title: ['Required'] });
    }

    const segment = RENAMABLE_ITEM_PATHS[itemType];
    if (!segment) {
      throw new AppError('validation', 'This item type cannot be renamed');
    }

    await serverFetch({
      service: 'content',
      path: `/${segment}/${refId}`,
      method: 'PATCH',
      body: { title: trimmed },
    });

    revalidatePath(`/school/content/${containerId}`);
  });
}

'use server';

import { revalidatePath } from 'next/cache';

import { tryAction } from '@/lib/result';

import { assignItemSection, removeItemFromDraft, reorderDraftItems } from '../lib/container-items';

export async function reorderContainerItemsAction(containerId: string, orderedItemIds: string[]) {
  return tryAction(async () => {
    await reorderDraftItems(containerId, orderedItemIds);
  });
}

/** Assigns (or clears) which section a draft item belongs to. Used by item editors of every content type. */
export async function assignItemSectionAction(
  containerId: string,
  containerItemId: string,
  sectionId: string | null,
) {
  return tryAction(async () => {
    await assignItemSection(containerId, containerItemId, sectionId);
    revalidatePath(`/school/content/${containerId}`);
  });
}

/**
 * Takes a row out of the draft version without touching what it points at.
 *
 * Deliberately not a delete of the underlying lesson, exercise or module: that
 * material can be placed in more than one course, and an author removing a
 * block from one syllabus does not mean to destroy it everywhere.
 */
export async function removeContainerItemAction(containerId: string, containerItemId: string) {
  return tryAction(async () => {
    await removeItemFromDraft(containerId, containerItemId);
    revalidatePath(`/school/content/${containerId}`);
  });
}

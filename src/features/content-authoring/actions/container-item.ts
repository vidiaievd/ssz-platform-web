'use server';

import { revalidatePath } from 'next/cache';

import { tryAction } from '@/lib/result';

import {
  addItemToDraft,
  assignItemSection,
  removeItemFromDraft,
  reorderDraftItems,
  type ContainerItemType,
} from '../lib/container-items';

/** One removed row, as the tree described it before it went (`describeRemoval`). */
export interface RestorableRow {
  itemType: ContainerItemType;
  /** The material the row points at — what is placed again. */
  refId: string;
  sectionId: string | null;
  /** The id the row had; the order list still names it. */
  removedItemId: string;
}

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

/**
 * Puts removed rows back where they were — the undo of a removal.
 *
 * A restored row cannot keep its id: placing material again mints a new one. So
 * the caller passes the order as it was, still naming the old ids, and this
 * swaps each of them for the row that replaced it. One reorder at the end
 * rather than one per row, because the endpoint wants the version's whole order
 * and would reject a list still naming a row that no longer exists.
 *
 * All rows must belong to `containerId`: the order being restored is that one
 * container's.
 */
export async function restoreContainerItemsAction(
  containerId: string,
  rows: RestorableRow[],
  previousOrderedItemIds: string[],
) {
  return tryAction(async () => {
    const restoredIdByRemovedId = new Map<string, string>();

    for (const row of rows) {
      const created = await addItemToDraft(containerId, row.itemType, row.refId);
      restoredIdByRemovedId.set(row.removedItemId, created.id);
      if (row.sectionId) {
        await assignItemSection(containerId, created.id, row.sectionId);
      }
    }

    await reorderDraftItems(
      containerId,
      previousOrderedItemIds.map((id) => restoredIdByRemovedId.get(id) ?? id),
    );
    revalidatePath(`/school/content/${containerId}`);
  });
}

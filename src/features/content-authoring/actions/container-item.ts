'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { tryAction } from '@/lib/result';

import {
  addItemToDraft,
  assignItemSection,
  duplicateDraftItem,
  listDraftItems,
  moveDraftItem,
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
 * Places material that is already placed somewhere once more — «Place again»
 * (plan 76, B1). The new row points at the same lesson or exercise, so an edit to
 * it shows in every place; a copy the author can change on its own is «Duplicate».
 *
 * `containerId` is the module receiving the row, which need not be the one the
 * original sits in. Returns the new row's id, which is what undo removes.
 */
export async function placeItemAgainAction(
  containerId: string,
  itemType: ContainerItemType,
  refId: string,
  sectionId: string | null,
) {
  return tryAction(async () => {
    const created = await addItemToDraft(containerId, itemType, refId, sectionId);
    revalidatePath(`/school/content/${containerId}`);
    return created;
  });
}

/**
 * «Duplicate» (plan 76, B1): a copy of the material the row places that the author
 * can change on its own, placed right after the row. Returns the new row and the
 * copy — both are what undo takes away.
 */
export async function duplicateContainerItemAction(containerId: string, containerItemId: string) {
  return tryAction(async () => {
    const duplicated = await duplicateDraftItem(containerId, containerItemId);
    revalidatePath(`/school/content/${containerId}`);
    return duplicated;
  });
}

/** One duplicate as undo needs it. */
export interface DuplicateToDiscard {
  /** The container whose draft holds the new row. */
  containerId: string;
  rowId: string;
  itemType: ContainerItemType;
  materialId: string;
}

/**
 * The undo of «Duplicate»: the new row goes, and so does the copy — unlike a removal,
 * which never deletes material. Nothing but this row ever placed the copy, so
 * nothing else loses it, and leaving it would strand it in the library.
 *
 * A module copy holds copies of its own: every exercise and lesson inside it was
 * made for it and goes with it. Its vocabulary lists and grammar rules are the
 * original's, placed again, and are left alone. The copies of a lesson's stage
 * exercises are not reached from here and stay behind.
 */
export async function discardDuplicateAction(duplicate: DuplicateToDiscard) {
  return tryAction(async () => {
    const { containerId, rowId, itemType, materialId } = duplicate;
    await removeItemFromDraft(containerId, rowId);

    if (itemType === 'container') {
      for (const row of await listDraftItems(materialId)) {
        if (row.itemType === 'exercise' || row.itemType === 'lesson') {
          await deleteMaterial(row.itemType, row.itemId);
        }
      }
    }
    await deleteMaterial(itemType, materialId);

    revalidatePath(`/school/content/${containerId}`);
  });
}

const DELETE_PATH: Partial<Record<ContainerItemType, string>> = {
  exercise: '/exercises',
  lesson: '/lessons',
  container: '/containers',
};

async function deleteMaterial(itemType: ContainerItemType, id: string): Promise<void> {
  const base = DELETE_PATH[itemType];
  if (!base) return;
  await serverFetch({ service: 'content', path: `${base}/${id}`, method: 'DELETE' });
}

/** One move of a block to another container — forward, or back as its undo. */
export interface MoveToContainer {
  /** The container whose draft holds the row now. */
  containerId: string;
  itemId: string;
  targetContainerId: string;
  targetSectionId: string | null;
  /**
   * The target's whole order once the row is there, naming the row by `itemId`.
   * Absent, the row stays last in its section. The moved row gets a new id, which
   * only this action learns, so the swap happens here.
   */
  targetOrder?: string[];
}

/**
 * «Move to → Another module» and a drop into another module (plan 39, B3). The
 * material is not touched: it leaves one draft and joins the other. Learners see
 * it move once both modules are published. Returns the row's new id.
 */
export async function moveItemToContainerAction(move: MoveToContainer) {
  return tryAction(async () => {
    const moved = await moveDraftItem(
      move.containerId,
      move.itemId,
      move.targetContainerId,
      move.targetSectionId,
    );
    if (move.targetOrder) {
      await reorderDraftItems(
        move.targetContainerId,
        move.targetOrder.map((id) => (id === move.itemId ? moved.id : id)),
      );
    }
    revalidatePath(`/school/content/${move.containerId}`);
    revalidatePath(`/school/content/${move.targetContainerId}`);
    return moved;
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

'use server';

import { revalidatePath } from 'next/cache';

import { tryAction } from '@/lib/result';

import {
  createDraftSection,
  deleteDraftSection,
  listDraftSections,
  renameDraftSection,
  reorderDraftSections,
  syncDraftSections,
} from '../lib/container-sections';
import { assignItemSection } from '../lib/container-items';

export async function listSectionsAction(containerId: string) {
  return tryAction(async () => listDraftSections(containerId));
}

export async function createSectionAction(containerId: string, title: string) {
  return tryAction(async () => {
    const result = await createDraftSection(containerId, title);
    revalidatePath(`/school/content/${containerId}`);
    return result;
  });
}

export async function renameSectionAction(containerId: string, sectionId: string, title: string) {
  return tryAction(async () => {
    await renameDraftSection(containerId, sectionId, title);
    revalidatePath(`/school/content/${containerId}`);
  });
}

export async function deleteSectionAction(containerId: string, sectionId: string) {
  return tryAction(async () => {
    await deleteDraftSection(containerId, sectionId);
    revalidatePath(`/school/content/${containerId}`);
  });
}

/**
 * Recreates a deleted level and takes back what it held — the undo of
 * `deleteSectionAction`.
 *
 * Deleting a section unassigns its rows rather than deleting them
 * (`delete-section.handler.ts`), so they are still in the course, ungrouped:
 * restoring means creating the section again and filing them back into it. The
 * new section has a new id, which is why the previous section order is passed
 * with the old one in it, to be swapped.
 */
export async function restoreSectionAction(
  containerId: string,
  title: string,
  position: number,
  memberItemIds: string[],
  previousOrderedSectionIds: string[],
  deletedSectionId: string,
) {
  return tryAction(async () => {
    const created = await createDraftSection(containerId, title, position);

    for (const itemId of memberItemIds) {
      await assignItemSection(containerId, itemId, created.sectionId);
    }

    await reorderDraftSections(
      containerId,
      previousOrderedSectionIds.map((id) => (id === deletedSectionId ? created.sectionId : id)),
    );
    revalidatePath(`/school/content/${containerId}`);
  });
}

export async function reorderSectionsAction(containerId: string, orderedSectionIds: string[]) {
  return tryAction(async () => {
    await reorderDraftSections(containerId, orderedSectionIds);
    revalidatePath(`/school/content/${containerId}`);
  });
}

/** Replaces the draft's sections with `titles`, used by the create-course flow's CEFR level-system scaffolding. */
export async function syncStructureSectionsAction(containerId: string, titles: string[]) {
  return tryAction(async () => {
    await syncDraftSections(containerId, titles);
  });
}

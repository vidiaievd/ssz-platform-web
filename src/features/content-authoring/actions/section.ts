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

export async function reorderSectionsAction(containerId: string, orderedSectionIds: string[]) {
  return tryAction(async () => {
    await reorderDraftSections(containerId, orderedSectionIds);
    revalidatePath(`/school/content/${containerId}`);
  });
}

/** Replaces the draft's sections with `titles`, used by the create-wizard's Structure step. */
export async function syncStructureSectionsAction(containerId: string, titles: string[]) {
  return tryAction(async () => {
    await syncDraftSections(containerId, titles);
  });
}

'use server';

import { revalidatePath } from 'next/cache';

import { tryAction } from '@/lib/result';

import { assignItemSection } from '../lib/container-items';

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

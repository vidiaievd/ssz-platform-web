import { serverFetch } from '@/lib/api/server-fetcher';
import type { ContainerSection } from '@/features/content/types';

import { requireDraftVersionId } from './container-items';

/** Lists sections attached to the container's draft version, ordered by position. */
export async function listDraftSections(containerId: string): Promise<ContainerSection[]> {
  const versionId = await requireDraftVersionId(containerId);
  return serverFetch<ContainerSection[]>({
    service: 'content',
    path: `/containers/${containerId}/versions/${versionId}/sections`,
  });
}

export async function createDraftSection(
  containerId: string,
  title: string,
  position?: number,
): Promise<{ sectionId: string; position: number }> {
  const versionId = await requireDraftVersionId(containerId);
  return serverFetch<{ sectionId: string; position: number }>({
    service: 'content',
    path: `/containers/${containerId}/versions/${versionId}/sections`,
    method: 'POST',
    body: { title, position },
  });
}

export async function renameDraftSection(
  containerId: string,
  sectionId: string,
  title: string,
): Promise<void> {
  const versionId = await requireDraftVersionId(containerId);
  await serverFetch({
    service: 'content',
    path: `/containers/${containerId}/versions/${versionId}/sections/${sectionId}`,
    method: 'PATCH',
    body: { title },
  });
}

export async function deleteDraftSection(containerId: string, sectionId: string): Promise<void> {
  const versionId = await requireDraftVersionId(containerId);
  await serverFetch({
    service: 'content',
    path: `/containers/${containerId}/versions/${versionId}/sections/${sectionId}`,
    method: 'DELETE',
  });
}

export async function reorderDraftSections(
  containerId: string,
  orderedSectionIds: string[],
): Promise<void> {
  const versionId = await requireDraftVersionId(containerId);
  await serverFetch({
    service: 'content',
    path: `/containers/${containerId}/versions/${versionId}/sections/reorder`,
    method: 'PUT',
    body: { orderedSectionIds },
  });
}

/**
 * Replaces the draft version's sections with `titles`, in order. Used by the
 * create-wizard's Structure step, which only offers a coarse "pick a scaffold"
 * choice (CEFR levels or blank) before any items exist — so a full
 * delete-and-recreate is safe and simpler than diffing.
 */
export async function syncDraftSections(containerId: string, titles: string[]): Promise<void> {
  const existing = await listDraftSections(containerId);
  for (const section of existing) {
    await deleteDraftSection(containerId, section.id);
  }
  for (const title of titles) {
    await createDraftSection(containerId, title);
  }
}

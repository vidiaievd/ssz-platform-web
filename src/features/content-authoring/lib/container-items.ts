import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { ContainerItem, ContainerVersion } from '@/features/content/types';

export type ContainerItemType = 'lesson' | 'vocabulary_list' | 'grammar_rule' | 'exercise' | 'container';

/**
 * Resolves the draft version of a container — the version that newly
 * created/edited content attaches to. Containers always have exactly one
 * draft version at a time (created automatically alongside the container).
 */
export async function getDraftVersionId(containerId: string): Promise<string | null> {
  try {
    const versions = await serverFetch<{ items: ContainerVersion[] }>({
      service: 'content',
      path: `/containers/${containerId}/versions`,
    });
    return versions.items.find((v) => v.status === 'draft')?.id ?? null;
  } catch {
    return null;
  }
}

export async function requireDraftVersionId(containerId: string): Promise<string> {
  const versionId = await getDraftVersionId(containerId);
  if (!versionId) {
    throw new AppError('not_found', 'No draft version found for container');
  }
  return versionId;
}

/**
 * Attaches a piece of reusable content (lesson, vocabulary list, ...) to the
 * container's draft version. The backend's `POST .../items` responds with
 * `{ itemId }` — the id of the newly created container-item itself, not the
 * `ContainerItem` shape returned by GET (where `itemId` instead means "id of
 * the referenced content"). Only the new item's own id is ever needed by
 * callers, so that's all this returns.
 */
export async function addItemToDraft(
  containerId: string,
  itemType: ContainerItemType,
  itemId: string,
): Promise<{ id: string }> {
  const versionId = await requireDraftVersionId(containerId);
  const created = await serverFetch<{ itemId: string }>({
    service: 'content',
    path: `/containers/${containerId}/versions/${versionId}/items`,
    method: 'POST',
    body: { itemType, itemId },
  });
  return { id: created.itemId };
}

/** Removes an item (by its container-item id, not the referenced content id) from the draft version. */
export async function removeItemFromDraft(containerId: string, containerItemId: string): Promise<void> {
  const versionId = await requireDraftVersionId(containerId);
  await serverFetch({
    service: 'content',
    path: `/containers/${containerId}/versions/${versionId}/items/${containerItemId}`,
    method: 'DELETE',
  });
}

/** Assigns (or clears, with sectionId = null) the section a draft item belongs to. */
export async function assignItemSection(
  containerId: string,
  containerItemId: string,
  sectionId: string | null,
): Promise<void> {
  const versionId = await requireDraftVersionId(containerId);
  await serverFetch({
    service: 'content',
    path: `/containers/${containerId}/versions/${versionId}/items/${containerItemId}`,
    method: 'PATCH',
    body: { sectionId },
  });
}

/**
 * Reorders all items in a container's draft version. The backend requires
 * `orderedItemIds` to cover every item in the version (a partial list is
 * rejected), so callers must pass the full flattened order.
 */
export async function reorderDraftItems(containerId: string, orderedItemIds: string[]): Promise<void> {
  const versionId = await requireDraftVersionId(containerId);
  await serverFetch({
    service: 'content',
    path: `/containers/${containerId}/versions/${versionId}/items/reorder`,
    method: 'PUT',
    body: { orderedItemIds },
  });
}

/** Lists items attached to the container's draft version, optionally filtered by type. */
export async function listDraftItems(
  containerId: string,
  itemType?: ContainerItemType,
): Promise<ContainerItem[]> {
  const versionId = await getDraftVersionId(containerId);
  if (!versionId) return [];
  const items = await serverFetch<ContainerItem[]>({
    service: 'content',
    path: `/containers/${containerId}/versions/${versionId}/items`,
  });
  return itemType ? items.filter((i) => i.itemType === itemType) : items;
}

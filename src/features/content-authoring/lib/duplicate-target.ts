import type { CurriculumTree, CurriculumTreeItemNode } from '@/features/content/types';

import { findItemWithModule } from './find-tree-item';

type ItemType = CurriculumTreeItemNode['itemType'];

/**
 * What «Duplicate» (plan 76, B1) acts on: a row of some container's draft, and
 * what the copy is called and selected as once it exists.
 */
export interface DuplicateTarget {
  /** The container whose draft holds the row — a module, or the course for its own rows. */
  containerId: string;
  rowId: string;
  itemType: ItemType;
  title: string;
  kind: 'module' | 'item';
}

/**
 * Lessons and exercises are copied; a module is copied from its course row. A
 * vocabulary list or grammar rule is not — those are placed again instead (Q4).
 */
export function canDuplicate(itemType: ItemType): boolean {
  return itemType === 'lesson' || itemType === 'exercise' || itemType === 'container';
}

/**
 * The duplicate target for a selected node id, or null when the node is a level
 * or a block of a type that is not copied. Module ids are the course rows that
 * place them, which is exactly the row the endpoint copies.
 */
export function duplicateTargetFor(
  tree: CurriculumTree,
  courseContainerId: string,
  id: string,
): DuplicateTarget | null {
  const mod = tree.levels.flatMap((level) => level.modules).find((m) => m.id === id);
  if (mod) {
    return {
      containerId: courseContainerId,
      rowId: mod.id,
      itemType: 'container',
      title: mod.title ?? '',
      kind: 'module',
    };
  }

  const found = findItemWithModule(tree, id);
  // An exact row only: the lookup falls back to content ids, and a copy of the
  // wrong row would land somewhere the author is not looking.
  if (!found || found.item.id !== id || !canDuplicate(found.item.itemType)) return null;
  return {
    containerId: found.moduleContainerId,
    rowId: id,
    itemType: found.item.itemType,
    title: found.item.title ?? '',
    kind: 'item',
  };
}

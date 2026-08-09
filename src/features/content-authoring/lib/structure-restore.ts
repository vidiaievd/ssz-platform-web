import type { CurriculumTree, CurriculumTreeLevelNode } from '@/features/content/types';

import { restoreContainerItemsAction, type RestorableRow } from '../actions/container-item';
import { restoreSectionAction } from '../actions/section';

import { flattenCourseEntries, flattenEntries } from './structure-dnd';
import type { UndoEntry } from './structure-undo';

/**
 * A row and the list it belonged to, read off the tree *before* it is removed.
 *
 * Both halves are needed and neither survives the removal: the material to
 * place again, and the order to restore — which still names the row by the id
 * it is about to lose.
 */
export interface RowRemoval {
  /** The container whose version placed the row. */
  containerId: string;
  row: RestorableRow;
  orderedItemIds: string[];
}

/**
 * Everything needed to put a row back, or null when the tree does not hold it.
 *
 * A module is a row like any other — a `container` item of the course — which
 * is why removing one and removing a block restore the same way.
 */
export function describeRemoval(
  tree: CurriculumTree,
  courseContainerId: string,
  itemId: string,
): RowRemoval | null {
  const courseOrder = () => flattenCourseEntries(tree).map((entry) => entry.id);

  for (const level of tree.levels) {
    for (const mod of level.modules) {
      if (mod.id === itemId) {
        return {
          containerId: courseContainerId,
          row: {
            itemType: 'container',
            refId: mod.containerId,
            sectionId: level.id,
            removedItemId: itemId,
          },
          orderedItemIds: courseOrder(),
        };
      }

      for (const section of mod.sections) {
        const item = section.items.find((candidate) => candidate.id === itemId);
        if (item) {
          return {
            containerId: mod.containerId,
            row: {
              itemType: item.itemType,
              refId: item.refId,
              sectionId: section.id,
              removedItemId: itemId,
            },
            orderedItemIds: flattenEntries(mod).map((entry) => entry.id),
          };
        }
      }

      const ungrouped = mod.ungroupedItems.find((candidate) => candidate.id === itemId);
      if (ungrouped) {
        return {
          containerId: mod.containerId,
          row: {
            itemType: ungrouped.itemType,
            refId: ungrouped.refId,
            sectionId: null,
            removedItemId: itemId,
          },
          orderedItemIds: flattenEntries(mod).map((entry) => entry.id),
        };
      }
    }

    const own = level.items.find((candidate) => candidate.id === itemId);
    if (own) {
      return {
        containerId: courseContainerId,
        row: {
          itemType: own.itemType,
          refId: own.refId,
          sectionId: level.id,
          removedItemId: itemId,
        },
        orderedItemIds: courseOrder(),
      };
    }
  }

  const loose = tree.ungroupedItems.find((candidate) => candidate.id === itemId);
  if (loose) {
    return {
      containerId: courseContainerId,
      row: {
        itemType: loose.itemType,
        refId: loose.refId,
        sectionId: null,
        removedItemId: itemId,
      },
      orderedItemIds: courseOrder(),
    };
  }

  return null;
}

/**
 * Restores rows removed together, one request per container they came from.
 *
 * Grouping is not an optimisation: each container's order has to be resubmitted
 * whole, and a list still naming rows that were not restored in the same call
 * would be rejected.
 */
export function rowRemovalUndo(label: string, removals: readonly RowRemoval[]): UndoEntry {
  const byContainer = new Map<string, RowRemoval[]>();
  for (const removal of removals) {
    const group = byContainer.get(removal.containerId);
    if (group) group.push(removal);
    else byContainer.set(removal.containerId, [removal]);
  }

  return {
    label,
    revert: async () => {
      for (const [containerId, group] of byContainer) {
        const result = await restoreContainerItemsAction(
          containerId,
          group.map((removal) => removal.row),
          // Every removal from one container carries the same list.
          group[0]?.orderedItemIds ?? [],
        );
        if (!result.ok) return false;
      }
      return true;
    },
  };
}

export interface LevelRemoval {
  title: string;
  position: number;
  /** The rows the level held — deleting it only unassigns them. */
  memberItemIds: string[];
  orderedSectionIds: string[];
  deletedSectionId: string;
}

export function describeLevelRemoval(
  tree: CurriculumTree,
  level: CurriculumTreeLevelNode,
): LevelRemoval | null {
  if (!level.id) return null;

  return {
    title: level.title ?? '',
    position: level.position,
    memberItemIds: [...level.modules.map((mod) => mod.id), ...level.items.map((item) => item.id)],
    orderedSectionIds: tree.levels
      .map((candidate) => candidate.id)
      .filter((id): id is string => id !== null),
    deletedSectionId: level.id,
  };
}

export function levelRemovalUndo(
  label: string,
  courseContainerId: string,
  removal: LevelRemoval,
): UndoEntry {
  return {
    label,
    revert: async () => {
      const result = await restoreSectionAction(
        courseContainerId,
        removal.title,
        removal.position,
        removal.memberItemIds,
        removal.orderedSectionIds,
        removal.deletedSectionId,
      );
      return result.ok;
    },
  };
}

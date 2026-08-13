import { assignItemSectionAction, reorderContainerItemsAction } from '../actions/container-item';
import { reorderSectionsAction } from '../actions/section';

import type { Entry } from './structure-dnd';
import type { UndoEntry } from './structure-undo';

export type UndoRecorder = (entry: UndoEntry) => void;

/**
 * Puts one ordered, grouped list back where it was — the inverse of every move
 * a block or a module can make.
 *
 * Both requests, in the order the forward move uses: the row returns to the
 * group it came from, then the whole order is resubmitted. The section is sent
 * even when the move never left it, because the undo cannot see where the row
 * sits now, and re-filing it where it already is costs one idempotent request.
 */
export function entryOrderUndo({
  label,
  containerId,
  itemId,
  entries,
}: {
  label: string;
  /** The container whose version holds the list — a module, or the course. */
  containerId: string;
  itemId: string;
  /** The list as it was *before* the move. */
  entries: readonly Entry[];
}): UndoEntry {
  const previous = entries.find((entry) => entry.id === itemId);

  return {
    label,
    revert: async () => {
      if (previous) {
        const filed = await assignItemSectionAction(containerId, itemId, previous.sectionId);
        if (!filed.ok) return false;
      }
      const ordered = await reorderContainerItemsAction(
        containerId,
        entries.map((entry) => entry.id),
      );
      return ordered.ok;
    },
  };
}

/** The same for levels, which are sections on the course and reorder through their own endpoint. */
export function sectionOrderUndo({
  label,
  containerId,
  orderedSectionIds,
}: {
  label: string;
  containerId: string;
  orderedSectionIds: readonly string[];
}): UndoEntry {
  return {
    label,
    revert: async () => {
      const result = await reorderSectionsAction(containerId, [...orderedSectionIds]);
      return result.ok;
    },
  };
}

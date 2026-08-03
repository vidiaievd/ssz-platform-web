import type {
  CurriculumTree,
  CurriculumTreeItemNode,
  CurriculumTreeModuleNode,
} from '@/features/content/types';

import type { CurriculumTreeSelection } from '../types';

/**
 * Re-resolves the current selection against a freshly refetched tree, so
 * in-place edits (rename, XP, state, …) don't leave the Inspector holding a
 * stale snapshot of the node it just saved.
 */
export function resolveSelection(
  tree: CurriculumTree,
  current: CurriculumTreeSelection,
): CurriculumTreeSelection | null {
  if (current.kind === 'level') {
    const level = tree.levels.find((l) => l.id === current.level.id);
    return level ? { kind: 'level', level } : null;
  }
  if (current.kind === 'module') {
    for (const level of tree.levels) {
      const mod = level.modules.find((m) => m.id === current.module.id);
      if (mod) return { kind: 'module', module: mod };
    }
    return null;
  }
  return findItemSelection(tree, current.item.id);
}

/** Locates a freshly created level or module by id, for auto-select after creation. */
export function findLevelOrModuleSelection(
  tree: CurriculumTree,
  kind: 'level' | 'module',
  id: string,
): CurriculumTreeSelection | null {
  if (kind === 'level') {
    const level = tree.levels.find((l) => l.id === id);
    return level ? { kind: 'level', level } : null;
  }
  for (const level of tree.levels) {
    const mod = level.modules.find((m) => m.id === id);
    if (mod) return { kind: 'module', module: mod };
  }
  return null;
}

/** Locates a freshly created (or any) item by id and builds its tree selection, for auto-select after creation. */
export function findItemSelection(
  tree: CurriculumTree,
  itemId: string,
): CurriculumTreeSelection | null {
  for (const level of tree.levels) {
    for (const mod of level.modules) {
      const found = findItemInModule(mod, itemId);
      if (found) return found;
    }
    // The edited container's own material, which a module keeps here.
    const own = level.items.find((i) => i.id === itemId);
    if (own) return { kind: 'item', item: own, sectionTitle: level.title };
  }
  const rootItem = tree.ungroupedItems.find((i) => i.id === itemId);
  if (rootItem) return { kind: 'item', item: rootItem, sectionTitle: null };
  return null;
}

function findItemInModule(
  mod: CurriculumTreeModuleNode,
  itemId: string,
): CurriculumTreeSelection | null {
  for (const section of mod.sections) {
    const item = section.items.find((i) => i.id === itemId);
    if (item) return { kind: 'item', item, sectionTitle: section.title };
  }
  const ungrouped = mod.ungroupedItems.find((i) => i.id === itemId);
  if (ungrouped) return { kind: 'item', item: ungrouped, sectionTitle: null };
  return null;
}

export interface ItemWithModule {
  item: CurriculumTreeItemNode;
  sectionTitle: string | null;
  /** Enclosing level's title (e.g. "B1"), for the editor breadcrumb. Null for `single` level systems. */
  levelTitle: string | null;
  /** The item's own Container — each module is its own Container (plan 30 §"Design ↔ backend terminology"). */
  moduleContainerId: string;
}

/**
 * Locates an item by id along with its enclosing module's `containerId`, needed
 * by the per-type editors (`LessonEditor`, `GrammarEditor`, …) which take the
 * module's full `Container` (FE2.1 lesson editor route).
 */
export function findItemWithModule(tree: CurriculumTree, itemId: string): ItemWithModule | null {
  // Container-item id first — that is what the tree links carry. Pre-flight
  // deep links carry the *content* id instead (a lesson id, not the id of the
  // row that places it), so refId is a deliberate second pass rather than a
  // guess; matching it in one pass would let another module's copy of the same
  // lesson win over the exact hit.
  return findBy(tree, (i) => i.id === itemId) ?? findBy(tree, (i) => i.refId === itemId);
}

function findBy(
  tree: CurriculumTree,
  match: (item: CurriculumTreeItemNode) => boolean,
): ItemWithModule | null {
  for (const level of tree.levels) {
    for (const mod of level.modules) {
      for (const section of mod.sections) {
        const item = section.items.find(match);
        if (item)
          return {
            item,
            sectionTitle: section.title,
            levelTitle: level.title,
            moduleContainerId: mod.containerId,
          };
      }
      const ungrouped = mod.ungroupedItems.find(match);
      if (ungrouped) {
        return {
          item: ungrouped,
          sectionTitle: null,
          levelTitle: level.title,
          moduleContainerId: mod.containerId,
        };
      }
    }

    // Material attached to the edited container itself — a module holds its
    // lessons here, and the editor for them is reached the same way.
    const own = level.items.find(match);
    if (own) {
      return {
        item: own,
        sectionTitle: level.title,
        levelTitle: null,
        moduleContainerId: tree.containerId,
      };
    }
  }

  const rootItem = tree.ungroupedItems.find(match);
  if (rootItem) {
    return {
      item: rootItem,
      sectionTitle: null,
      levelTitle: null,
      moduleContainerId: tree.containerId,
    };
  }

  return null;
}

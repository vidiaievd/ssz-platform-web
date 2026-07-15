import type { CurriculumTree, CurriculumTreeModuleNode } from '@/features/content/types';

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
export function findItemSelection(tree: CurriculumTree, itemId: string): CurriculumTreeSelection | null {
  for (const level of tree.levels) {
    for (const mod of level.modules) {
      const found = findItemInModule(mod, itemId);
      if (found) return found;
    }
  }
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

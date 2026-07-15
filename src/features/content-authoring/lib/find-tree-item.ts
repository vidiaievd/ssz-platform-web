import type { CurriculumTree, CurriculumTreeModuleNode } from '@/features/content/types';

import type { CurriculumTreeSelection } from '../types';

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

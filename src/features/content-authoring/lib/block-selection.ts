import type { CurriculumTree } from '@/features/content/types';

import { moduleItems } from './structure-filters';

/**
 * A block as the bulk bar needs it: what to call it, and which container's item
 * list actually places it.
 *
 * The container matters because "remove this block" is a request against its
 * holder, and a course tree holds blocks in three different places — inside a
 * module, directly in a level of the edited container, or ungrouped on the
 * container itself. Only the first has a container id of its own.
 */
export interface StructureBlock {
  id: string;
  title: string;
  containerId: string;
}

/**
 * Every block in the tree, in the order it is drawn, paired with its holder.
 *
 * `courseContainerId` is the container being edited — a course when the screen
 * shows a course, a module when it shows one module — and owns everything that
 * does not sit inside a nested module.
 */
export function collectBlocks(tree: CurriculumTree, courseContainerId: string): StructureBlock[] {
  const blocks: StructureBlock[] = [];

  for (const level of tree.levels) {
    for (const mod of level.modules) {
      for (const item of moduleItems(mod)) {
        blocks.push({ id: item.id, title: item.title ?? '', containerId: mod.containerId });
      }
    }
    for (const item of level.items) {
      blocks.push({ id: item.id, title: item.title ?? '', containerId: courseContainerId });
    }
  }

  for (const item of tree.ungroupedItems) {
    blocks.push({ id: item.id, title: item.title ?? '', containerId: courseContainerId });
  }

  return blocks;
}

/**
 * The checked blocks, resolved against the current tree.
 *
 * Resolving rather than trusting the id set is what keeps multi-select honest
 * across a refetch: a block someone else removed, or one this bar just deleted,
 * drops out of the count and out of the next bulk action on its own, with no
 * state to keep in sync.
 */
export function checkedBlocks(
  tree: CurriculumTree,
  courseContainerId: string,
  checked: ReadonlySet<string>,
): StructureBlock[] {
  if (checked.size === 0) return [];
  return collectBlocks(tree, courseContainerId).filter((block) => checked.has(block.id));
}

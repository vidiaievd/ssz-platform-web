import type { CurriculumTree, CurriculumTreeItemNode } from '@/features/content/types';

import { getMaterialKind } from './material-kind';

export interface StructureMetrics {
  levels: number;
  modules: number;
  /** Every leaf item in the course, whatever its kind. */
  lessons: number;
  exercises: number;
  /** Sum of `durationMinutes` over every leaf; items without one contribute nothing. */
  estimatedMinutes: number;
}

/**
 * Every leaf item in the tree, in no particular order — a module keeps its
 * material in sections plus an ungrouped bucket, and the container being edited
 * keeps its own on the level and in a bucket of its own.
 */
function collectItems(tree: CurriculumTree): CurriculumTreeItemNode[] {
  return [
    ...tree.ungroupedItems,
    ...tree.levels.flatMap((level) => [
      ...level.items,
      ...level.modules.flatMap((module) => [
        ...module.sections.flatMap((section) => section.items),
        ...module.ungroupedItems,
      ]),
    ]),
  ];
}

/**
 * The header's metric strip.
 *
 * Deliberately does not count what is unpublished: that number has to match the
 * publish dialog exactly (BEHAVIOR.md §5.2), so it comes from
 * `collectPublishRows` — the same source the dialog itself lists — rather than
 * being recomputed here from different premises.
 */
export function computeStructureMetrics(tree: CurriculumTree | undefined): StructureMetrics {
  if (!tree) {
    return { levels: 0, modules: 0, lessons: 0, exercises: 0, estimatedMinutes: 0 };
  }

  const items = collectItems(tree);

  return {
    levels: tree.levels.length,
    modules: tree.levels.reduce((sum, level) => sum + level.modules.length, 0),
    lessons: items.length,
    exercises: items.filter((item) => getMaterialKind(item) === 'exercise').length,
    estimatedMinutes: items.reduce((sum, item) => sum + (item.durationMinutes ?? 0), 0),
  };
}

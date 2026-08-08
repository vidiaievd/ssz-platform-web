import type {
  CurriculumTree,
  CurriculumTreeLevelNode,
  CurriculumTreeModuleNode,
} from '@/features/content/types';

/**
 * Collapse keys for the structure tree.
 *
 * The tree and the topbar's Expand/Collapse all buttons live in different
 * components, so the key has to be derivable from the node alone. A level has
 * no id when the container was never given sections, hence the positional
 * fallback — one such level per container, so it cannot collide.
 */
export function levelCollapseKey(level: CurriculumTreeLevelNode): string {
  return `level:${level.id ?? `pos-${level.position}`}`;
}

export function moduleCollapseKey(module: CurriculumTreeModuleNode): string {
  return `module:${module.id}`;
}

/** DOM id of a level's row in the tree — the rail's jump target. */
export function levelDomId(level: CurriculumTreeLevelNode): string {
  return `structure-${levelCollapseKey(level)}`;
}

/** Every node in the tree that can be collapsed — what "Collapse all" expands to. */
export function allCollapseKeys(tree: CurriculumTree | undefined): string[] {
  if (!tree) return [];
  return tree.levels.flatMap((level) => [
    levelCollapseKey(level),
    ...level.modules.map(moduleCollapseKey),
  ]);
}

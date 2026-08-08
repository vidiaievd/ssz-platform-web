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

/**
 * A numbered prefix an author typed into the title: "Leksjon 1 — ", "Level 2 - ",
 * "Unit 3: ". Word, space, number, separator.
 *
 * The space is required. Without it this also eats "A1 — Beginner", which is not
 * a prefix at all but the CEFR band a course is scaffolded with.
 */
const NUMBERED_PREFIX = /^\s*\p{L}+\s+\d+\s*[—–\-:.]\s*/u;

/**
 * The level's title without the "Leksjon N —" it usually opens with. The rail
 * already numbers each level in its own badge, so repeating it in the label
 * costs the width that the actual topic needs.
 *
 * Falls back to the full title when stripping would leave nothing — a level
 * genuinely called "Leksjon 1" has no other name to show.
 */
export function stripLevelPrefix(title: string | null): string {
  if (!title) return '';
  const stripped = title.replace(NUMBERED_PREFIX, '').trim();
  return stripped || title;
}

/** Every node in the tree that can be collapsed — what "Collapse all" expands to. */
export function allCollapseKeys(tree: CurriculumTree | undefined): string[] {
  if (!tree) return [];
  return tree.levels.flatMap((level) => [
    levelCollapseKey(level),
    ...level.modules.map(moduleCollapseKey),
  ]);
}

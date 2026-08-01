import type { CurriculumTree } from '@/features/content/types';

/** A grammar rule an annotation in this Leksjon's texts may point at. */
export interface LevelGrammarRule {
  /** The rule's own id — what a grammar span stores as its `refId`. */
  id: string;
  title: string;
  /** The module holding it, shown when several modules of the Leksjon carry rules. */
  moduleTitle: string | null;
}

/**
 * The grammar rules of the Leksjon a module belongs to.
 *
 * A course keeps its grammar in a module of its own ("Grammatikk og øvelser"),
 * while the texts that illustrate a rule sit in sibling modules — so a text's
 * own module is by itself the wrong scope, and the whole course is too wide: a
 * text should point at the grammar its reader is working through right now, not
 * at a rule from Leksjon 9.
 *
 * Derived from the curriculum tree the editor route already loads, so scoping
 * costs no request at all.
 */
export function collectLevelGrammarRules(
  tree: CurriculumTree,
  moduleContainerId: string,
): LevelGrammarRule[] {
  const level = tree.levels.find((l) =>
    l.modules.some((m) => m.containerId === moduleContainerId),
  );
  if (!level) return [];

  const byId = new Map<string, LevelGrammarRule>();
  for (const node of level.modules) {
    const items = [...node.sections.flatMap((s) => s.items), ...node.ungroupedItems];
    for (const item of items) {
      if (item.itemType !== 'grammar_rule') continue;
      // First occurrence wins: the same rule placed in two modules of a Leksjon
      // is one rule to annotate against, not two entries to choose between.
      if (byId.has(item.refId)) continue;
      byId.set(item.refId, {
        id: item.refId,
        title: item.title ?? '',
        moduleTitle: node.title,
      });
    }
  }

  return [...byId.values()];
}

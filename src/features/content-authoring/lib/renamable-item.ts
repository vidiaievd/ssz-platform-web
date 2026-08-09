import type { CurriculumTreeItemNode } from '@/features/content/types';

/**
 * Item types whose underlying entity carries a title of its own, mapped to the
 * content-service collection that owns it.
 *
 * `exercise` is absent on purpose: an exercise row is labelled by its
 * *template's* name (`get-curriculum-tree.handler.ts` selects `template.name`),
 * and no per-exercise title field exists to write to. That is also why a lesson
 * full of exercises shows the same label repeated.
 *
 * Lives here rather than beside the server action because a `'use server'`
 * module may only export async functions.
 */
export const RENAMABLE_ITEM_PATHS = {
  lesson: 'lessons',
  vocabulary_list: 'vocabulary-lists',
  grammar_rule: 'grammar-rules',
} as const;

export type RenamableItemType = keyof typeof RENAMABLE_ITEM_PATHS;

export function isRenamableItem(item: CurriculumTreeItemNode): boolean {
  return item.itemType in RENAMABLE_ITEM_PATHS;
}

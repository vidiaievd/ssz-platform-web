import type { CurriculumTreeItemNode } from '@/features/content/types';

/**
 * Item types whose underlying entity carries a title of its own, mapped to the
 * content-service collection that owns it.
 *
 * An exercise's title is optional (plan 39, B8): without one the row is labelled
 * by `content.title`, then by its template's name. So for an exercise a blank
 * title is a valid save — it clears the title and the fallback comes back —
 * while every other type requires one.
 *
 * Lives here rather than beside the server action because a `'use server'`
 * module may only export async functions.
 */
export const RENAMABLE_ITEM_PATHS = {
  lesson: 'lessons',
  vocabulary_list: 'vocabulary-lists',
  grammar_rule: 'grammar-rules',
  exercise: 'exercises',
} as const;

export type RenamableItemType = keyof typeof RENAMABLE_ITEM_PATHS;

export function isRenamableItem(item: CurriculumTreeItemNode): boolean {
  return item.itemType in RENAMABLE_ITEM_PATHS;
}

/** Whether saving a blank title clears it rather than being refused. */
export function isTitleOptional(itemType: CurriculumTreeItemNode['itemType']): boolean {
  return itemType === 'exercise';
}

/**
 * The title the author wrote, as opposed to the label the row shows. They differ
 * only for an exercise, whose label falls back past a missing title — reverting a
 * rename has to restore *this*, or undoing a first rename would pin the template
 * name as the exercise's title.
 */
export function ownTitleOf(item: CurriculumTreeItemNode): string {
  return isTitleOptional(item.itemType) ? (item.ownTitle ?? '') : (item.title ?? '');
}

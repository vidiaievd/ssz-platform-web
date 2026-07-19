import type { MaterialKind } from '@/lib/content/lesson-types';
import type { CurriculumTreeItemNode } from '@/features/content/types';

/**
 * Resolves a curriculum-tree item to its FE `MaterialKind` (lesson-types registry key).
 * `vocabulary_list`/`grammar_rule`/`exercise` map 1:1; `lesson` is disambiguated by
 * `lessonKind` (plan 29 §0 — Lesson.kind drives editor/reader selection).
 */
export function getMaterialKind(item: CurriculumTreeItemNode): MaterialKind {
  switch (item.itemType) {
    case 'vocabulary_list':
      return 'vocab';
    case 'grammar_rule':
      return 'grammar';
    case 'exercise':
      return 'exercise';
    case 'lesson':
    case 'container':
    default:
      return (item.lessonKind as MaterialKind | null) ?? 'text';
  }
}

import { keyFactory } from '@/lib/query/keys';

import type { ContainerFilters } from '../schemas';

export const contentKeys = keyFactory('content', {
  containers: (filters?: Omit<ContainerFilters, 'cursor'>) => ['containers', filters ?? {}] as const,
  container: (id: string) => ['container', id] as const,
  containerBySlug: (slug: string) => ['container', 'slug', slug] as const,
  containerItems: (containerId: string, versionId: string) =>
    ['container', containerId, 'items', versionId] as const,
  lesson: (id: string) => ['lesson', id] as const,
  lessonVariant: (lessonId: string) => ['lesson', lessonId, 'variant'] as const,
  lessonParagraphs: (lessonId: string, variantId: string) =>
    ['lesson', lessonId, 'variant', variantId, 'paragraphs'] as const,
  lessonGlossaryMarks: (lessonId: string, variantId: string) =>
    ['lesson', lessonId, 'variant', variantId, 'glossary-marks'] as const,
  lessonVideoCues: (lessonId: string, variantId: string) =>
    ['lesson', lessonId, 'variant', variantId, 'cues'] as const,
  vocabularyList: (listId: string) => ['vocabulary-list', listId] as const,
  vocabularyItems: (listId: string) => ['vocabulary-list', listId, 'items'] as const,
  vocabularyItemsFlat: (listId: string) => ['vocabulary-list', listId, 'items', 'flat'] as const,
  grammarRule: (id: string) => ['grammar-rule', id] as const,
  grammarExplanation: (ruleId: string) => ['grammar-rule', ruleId, 'explanation'] as const,
  exercise: (id: string) => ['exercise', id] as const,
});

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
  // Authoring reads with includeBroken=true and the reader without, and the two
  // get different rows back — so the flag has to be part of the key.
  lessonTextSpans: (lessonId: string, variantId: string, includeBroken = false) =>
    ['lesson', lessonId, 'variant', variantId, 'spans', { includeBroken }] as const,
  lessonVideoCues: (lessonId: string, variantId: string) =>
    ['lesson', lessonId, 'variant', variantId, 'cues'] as const,
  lessonListeningStages: (lessonId: string, variantId: string) =>
    ['lesson', lessonId, 'variant', variantId, 'listening-stages'] as const,
  vocabularyList: (listId: string) => ['vocabulary-list', listId] as const,
  vocabularyItems: (listId: string) => ['vocabulary-list', listId, 'items'] as const,
  vocabularyItemsFlat: (listId: string) => ['vocabulary-list', listId, 'items', 'flat'] as const,
  grammarRule: (id: string) => ['grammar-rule', id] as const,
  grammarExplanation: (ruleId: string) => ['grammar-rule', ruleId, 'explanation'] as const,
  exercise: (id: string) => ['exercise', id] as const,
  exerciseAnswers: (id: string) => ['exercise', id, 'answers'] as const,
  /** What a learner is served: the published document, key only where the browser grades. */
  exerciseForRunner: (id: string) => ['exercise', id, 'runner'] as const,
});

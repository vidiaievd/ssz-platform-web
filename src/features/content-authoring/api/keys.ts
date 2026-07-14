import { keyFactory } from '@/lib/query/keys';

import type { AuthoringFilters, ContainerListQuery } from '../types';

export const authoringKeys = keyFactory('authoring', {
  containers: (filters?: AuthoringFilters | ContainerListQuery) => ['containers', filters ?? {}] as const,
  container: (id: string) => ['container', id] as const,
  preflight: (id: string) => ['preflight', id] as const,
  activity: (id: string) => ['activity', id] as const,
  lessons: (containerId: string) => ['lessons', containerId] as const,
  lesson: (id: string) => ['lesson', id] as const,
  lessonVariants: (lessonId: string) => ['lesson-variants', lessonId] as const,
  vocabularyLists: (containerId: string) => ['vocabulary-lists', containerId] as const,
  vocabularyList: (listId: string) => ['vocabulary-list', listId] as const,
  vocabularyItems: (listId: string, page: number) =>
    ['vocabulary-list', listId, 'items', page] as const,
  vocabularyItemsAll: (listId: string) => ['vocabulary-list', listId, 'items'] as const,
  vocabularyItem: (listId: string, itemId: string) => ['vocabulary-item', listId, itemId] as const,
  grammarRules: (containerId: string) => ['grammar-rules', containerId] as const,
  grammarRule: (id: string) => ['grammar-rule', id] as const,
  grammarExplanations: (ruleId: string) => ['grammar-explanations', ruleId] as const,
  exercises: (containerId: string) => ['exercises', containerId] as const,
  exercise: (id: string) => ['exercise', id] as const,
  sections: (containerId: string) => ['sections', containerId] as const,
  versions: (containerId: string) => ['versions', containerId] as const,
  tree: (containerId: string, versionId: string) => ['tree', containerId, versionId] as const,
  tags: (entityType: string, entityId: string) => ['tags', entityType, entityId] as const,
  shares: (entityType: string, entityId: string) => ['shares', entityType, entityId] as const,
});

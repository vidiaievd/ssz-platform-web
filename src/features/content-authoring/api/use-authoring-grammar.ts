'use client';

import { useQuery } from '@tanstack/react-query';

import type { ContainerItem, GrammarRule, GrammarExplanation } from '@/features/content/types';

import { authoringKeys } from './keys';

export function useAuthoringGrammarRules(containerId: string, enabled = true) {
  return useQuery<GrammarRule[]>({
    queryKey: authoringKeys.grammarRules(containerId),
    queryFn: async () => {
      const res = await fetch(`/api/content/containers/${containerId}/items?draft=true`);
      if (!res.ok) throw new Error('Failed to fetch grammar rules');
      const items: ContainerItem[] = await res.json();
      return items
        .filter((i) => i.itemType === 'grammar_rule')
        .map((i) => ({
          id: i.itemId,
          title: i.title ?? '',
          targetLanguage: '',
          createdAt: i.addedAt,
          containerItemId: i.id,
          sectionId: i.sectionId,
        }));
    },
    enabled: enabled && !!containerId,
    staleTime: 30_000,
  });
}

export function useAuthoringGrammarExplanations(ruleId: string, enabled = true) {
  return useQuery<GrammarExplanation[]>({
    queryKey: authoringKeys.grammarExplanations(ruleId),
    queryFn: async () => {
      const res = await fetch(`/api/content/grammar-rules/${ruleId}/explanations`);
      if (!res.ok) return [];
      return res.json() as Promise<GrammarExplanation[]>;
    },
    enabled: enabled && !!ruleId,
    staleTime: 60_000,
  });
}

'use client';

import { useQuery } from '@tanstack/react-query';

import type { GrammarRule, GrammarExplanation, PaginatedResponse } from '@/features/content/types';

import { authoringKeys } from './keys';

export function useAuthoringGrammarRules(containerId: string, enabled = true) {
  return useQuery<GrammarRule[]>({
    queryKey: authoringKeys.grammarRules(containerId),
    queryFn: async () => {
      const res = await fetch(
        `/api/content/grammar-rules?containerId=${containerId}&limit=200`,
      );
      if (!res.ok) throw new Error('Failed to fetch grammar rules');
      const data: PaginatedResponse<GrammarRule> = await res.json();
      return data.items;
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

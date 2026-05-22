'use client';

import { useQuery } from '@tanstack/react-query';

import type { GrammarExplanation, GrammarRule } from '../types';
import { contentKeys } from './keys';

export function useGrammarRule(id: string, enabled = true) {
  return useQuery<GrammarRule>({
    queryKey: contentKeys.grammarRule(id),
    queryFn: async () => {
      const res = await fetch(`/api/content/grammar-rules/${id}`);
      if (!res.ok) throw new Error('Failed to fetch grammar rule');
      return res.json() as Promise<GrammarRule>;
    },
    staleTime: 120_000,
    enabled: enabled && !!id,
  });
}

export function useBestGrammarExplanation(ruleId: string, enabled = true) {
  return useQuery<GrammarExplanation>({
    queryKey: contentKeys.grammarExplanation(ruleId),
    queryFn: async () => {
      const res = await fetch(`/api/content/grammar-rules/${ruleId}/explanation`);
      if (!res.ok) throw new Error('Failed to fetch grammar explanation');
      return res.json() as Promise<GrammarExplanation>;
    },
    staleTime: 120_000,
    enabled: enabled && !!ruleId,
  });
}

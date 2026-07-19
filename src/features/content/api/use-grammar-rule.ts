'use client';

import { useQuery } from '@tanstack/react-query';

import type { GrammarExplanationDetail, GrammarRule } from '../types';
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

export function useBestGrammarExplanation(
  ruleId: string,
  lang: string,
  level: string,
  enabled = true,
) {
  return useQuery<GrammarExplanationDetail>({
    queryKey: [...contentKeys.grammarExplanation(ruleId), lang, level],
    queryFn: async () => {
      const params = new URLSearchParams({ lang, level });
      const res = await fetch(`/api/content/grammar-rules/${ruleId}/explanation?${params}`);
      if (!res.ok) throw new Error('Failed to fetch grammar explanation');
      return res.json() as Promise<GrammarExplanationDetail>;
    },
    staleTime: 120_000,
    enabled: enabled && !!ruleId && !!lang && !!level,
  });
}

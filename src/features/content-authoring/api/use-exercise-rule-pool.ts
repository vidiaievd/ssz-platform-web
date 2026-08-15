'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ExerciseRuleLink } from '@/features/content/types';

import { authoringKeys } from './keys';

/**
 * Which grammar rules practise this exercise, and the two writes that change that.
 *
 * The pool is a relation owned by content-service (rule ↔ exercise, position, weight), not
 * a field of the exercise document — plan 42 keeps it that way deliberately: a copy of the
 * link inside `content` would be a second source of truth about the same fact. So the panel
 * reads and writes the relation directly and holds nothing of its own.
 */
export function useExerciseRuleLinks(exerciseId: string, enabled = true) {
  return useQuery<ExerciseRuleLink[]>({
    queryKey: authoringKeys.exerciseRuleLinks(exerciseId),
    queryFn: async () => {
      const res = await fetch(`/api/content/exercises/${exerciseId}/grammar-rules`);
      if (!res.ok) throw new Error('Failed to fetch the grammar rules of this exercise');
      return res.json() as Promise<ExerciseRuleLink[]>;
    },
    enabled: enabled && exerciseId !== '',
    staleTime: 30_000,
  });
}

export function useAttachExerciseToRule(exerciseId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ruleId, weight }: { ruleId: string; weight?: number }) => {
      const res = await fetch(`/api/content/grammar-rules/${ruleId}/pool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exerciseId, weight }),
      });
      // 409 means it is already there — the state the caller wanted, reached by someone
      // else. Refetching below reconciles it; failing would ask the author to fix nothing.
      if (!res.ok && res.status !== 409) throw new Error('Failed to add to the pool');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: authoringKeys.exerciseRuleLinks(exerciseId),
      });
    },
  });
}

export function useSetRulePoolWeight(exerciseId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ruleId, weight }: { ruleId: string; weight: number }) => {
      const res = await fetch(`/api/content/grammar-rules/${ruleId}/pool/${exerciseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weight }),
      });
      if (!res.ok) throw new Error('Failed to update the pool entry');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: authoringKeys.exerciseRuleLinks(exerciseId),
      });
    },
  });
}

export function useDetachExerciseFromRule(exerciseId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ruleId }: { ruleId: string }) => {
      const res = await fetch(`/api/content/grammar-rules/${ruleId}/pool/${exerciseId}`, {
        method: 'DELETE',
      });
      if (!res.ok && res.status !== 404) throw new Error('Failed to remove from the pool');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: authoringKeys.exerciseRuleLinks(exerciseId),
      });
    },
  });
}

'use client';

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import type { GrammarRuleAtom } from '@/features/content/types';

import type { AtomType, ExerciseTargets, TargetRole, TargetSuggestions } from '../types';

import { authoringKeys } from './keys';

/**
 * What each piece of this exercise is about — plan 63, phase 1.
 *
 * The list is resolved server-side against the document as it stands, including the
 * unreleased edit, so it is refetched rather than cached long: a gap key holds a token
 * index, and an author who has just moved a word has moved the address with it.
 */
export function useExerciseTargets(exerciseId: string, enabled = true) {
  return useQuery<ExerciseTargets>({
    queryKey: authoringKeys.exerciseTargets(exerciseId),
    queryFn: async () => {
      const res = await fetch(`/api/content/exercises/${exerciseId}/targets`);
      if (!res.ok) throw new Error('Failed to read what this exercise is about');
      return res.json() as Promise<ExerciseTargets>;
    },
    enabled: enabled && exerciseId !== '',
  });
}

/**
 * Proposals from what the catalogue already records. Never written without the author.
 *
 * A failure here is not a failure of the panel: the targets above it still read and write,
 * and the suggester going quiet costs proposals, not addressing.
 */
export function useTargetSuggestions(exerciseId: string, enabled = true) {
  return useQuery<TargetSuggestions>({
    queryKey: authoringKeys.exerciseTargetSuggestions(exerciseId),
    queryFn: async () => {
      const res = await fetch(`/api/content/exercises/${exerciseId}/target-suggestions`);
      if (!res.ok) throw new Error('Failed to read the suggestions');
      return res.json() as Promise<TargetSuggestions>;
    },
    enabled: enabled && exerciseId !== '',
    retry: false,
    staleTime: 60_000,
  });
}

export interface ItemTargetInput {
  atomType: AtomType;
  atomId: string;
  role: TargetRole;
}

/**
 * Replace what one item is about.
 *
 * The whole statement travels every time, because that is what the service stores: "this
 * gap is about these atoms". The panel therefore sends the list it is showing, which is
 * also what makes removing the last target mean "about nothing in particular" rather than
 * "never said".
 *
 * Both queries are invalidated: a suggestion accepted changes `alreadyAddressed` on the
 * item, and a panel that kept offering what the author had just taken would read as a
 * save that did not happen.
 */
export function useSetItemTargets(exerciseId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemKey,
      targets,
    }: {
      itemKey: string | null;
      targets: ItemTargetInput[];
    }) => {
      const res = await fetch(`/api/content/exercises/${exerciseId}/targets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemKey, targets }),
      });
      if (!res.ok) throw new Error('Failed to save what this item is about');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: authoringKeys.exerciseTargets(exerciseId) });
      void queryClient.invalidateQueries({
        queryKey: authoringKeys.exerciseTargetSuggestions(exerciseId),
      });
    },
  });
}

/**
 * The atoms of every rule this exercise sits in the pool of — the choices an author has
 * when the suggester has nothing to offer for a gap.
 *
 * One query per rule rather than a composite route: the lists are small, they are already
 * the cache entries the rule editor fills, and a new endpoint would need its own notion of
 * "the rules of an exercise" beside the one the pool already answers.
 */
export function useAtomsOfRules(ruleIds: string[]) {
  const results = useQueries({
    queries: ruleIds.map((ruleId) => ({
      queryKey: authoringKeys.grammarAtoms(ruleId),
      queryFn: async () => {
        const res = await fetch(`/api/content/grammar-rules/${ruleId}/atoms`);
        if (!res.ok) throw new Error('Failed to fetch the atoms of this rule');
        return res.json() as Promise<GrammarRuleAtom[]>;
      },
      staleTime: 30_000,
    })),
  });

  return {
    atoms: results.flatMap((result) => result.data ?? []),
    isLoading: results.some((result) => result.isLoading),
  };
}

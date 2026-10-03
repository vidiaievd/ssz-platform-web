'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AtomTrack, GrammarRuleAtom } from '@/features/content/types';

import { authoringKeys } from './keys';

/**
 * What a rule is made of — plan 63, phase 0.
 *
 * The list is owned by content-service and lives beside the rule, not inside its
 * explanation document: an atom outlives the wording of the rule it was cut out of, and a
 * learner's memory and an exercise's targets both point at it by id.
 *
 * Every write here invalidates the list and nothing else. Renaming, re-tracking and
 * retiring an atom are all safe for what a learner owns, so no other query goes stale.
 */
export function useGrammarAtoms(ruleId: string, enabled = true) {
  return useQuery<GrammarRuleAtom[]>({
    queryKey: authoringKeys.grammarAtoms(ruleId),
    queryFn: async () => {
      const res = await fetch(`/api/content/grammar-rules/${ruleId}/atoms`);
      if (!res.ok) throw new Error('Failed to fetch the atoms of this rule');
      return res.json() as Promise<GrammarRuleAtom[]>;
    },
    enabled: enabled && ruleId !== '',
    staleTime: 30_000,
  });
}

/** Thrown when the rule already holds a living atom under this key. */
export class AtomKeyTakenError extends Error {
  constructor() {
    super('key_taken');
    this.name = 'AtomKeyTakenError';
  }
}

async function expectOk(res: Response, message: string): Promise<void> {
  if (res.status === 409) throw new AtomKeyTakenError();
  if (!res.ok) throw new Error(message);
}

export interface CreateAtomInput {
  key: string;
  title: string;
  track: AtomTrack;
  description?: string;
}

export function useCreateGrammarAtom(ruleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAtomInput) => {
      const res = await fetch(`/api/content/grammar-rules/${ruleId}/atoms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      await expectOk(res, 'Failed to add the atom');
      return res.json() as Promise<{ atomId: string }>;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: authoringKeys.grammarAtoms(ruleId) });
    },
  });
}

export interface UpdateAtomInput {
  atomId: string;
  key?: string;
  title?: string;
  description?: string;
  track?: AtomTrack;
}

export function useUpdateGrammarAtom(ruleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ atomId, ...patch }: UpdateAtomInput) => {
      const res = await fetch(`/api/content/grammar-rules/${ruleId}/atoms/${atomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      await expectOk(res, 'Failed to update the atom');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: authoringKeys.grammarAtoms(ruleId) });
    },
  });
}

export function useDeleteGrammarAtom(ruleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ atomId }: { atomId: string }) => {
      const res = await fetch(`/api/content/grammar-rules/${ruleId}/atoms/${atomId}`, {
        method: 'DELETE',
      });
      // Already retired by somebody else is the state the author asked for, reached without
      // them; 410 is the backend saying exactly that.
      if (!res.ok && res.status !== 404 && res.status !== 410) {
        throw new Error('Failed to retire the atom');
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: authoringKeys.grammarAtoms(ruleId) });
    },
  });
}

export function useReorderGrammarAtoms(ruleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ items }: { items: Array<{ atomId: string; position: number }> }) => {
      const res = await fetch(`/api/content/grammar-rules/${ruleId}/atoms/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error('Failed to reorder the atoms');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: authoringKeys.grammarAtoms(ruleId) });
    },
  });
}

export function useMoveGrammarAtom(ruleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      atomId,
      targetRuleId,
      key,
    }: {
      atomId: string;
      targetRuleId: string;
      key?: string;
    }) => {
      const res = await fetch(`/api/content/grammar-rules/${ruleId}/atoms/${atomId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetRuleId, key }),
      });
      await expectOk(res, 'Failed to move the atom');
      return { targetRuleId };
    },
    onSettled: (result) => {
      void queryClient.invalidateQueries({ queryKey: authoringKeys.grammarAtoms(ruleId) });
      // The destination's list has grown by one, and it may well be open in another pane.
      if (result) {
        void queryClient.invalidateQueries({
          queryKey: authoringKeys.grammarAtoms(result.targetRuleId),
        });
      }
    },
  });
}

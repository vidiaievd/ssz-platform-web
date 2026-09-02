'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CoverageFocus, CoverageSkill, ExerciseAxes } from '../types';

import { authoringKeys } from './keys';

async function call(exerciseId: string, init?: RequestInit): Promise<ExerciseAxes> {
  const res = await fetch(`/api/content/exercises/${exerciseId}/skills`, init);
  if (!res.ok) throw new Error('Failed to read the axes');
  return res.json() as Promise<ExerciseAxes>;
}

export function useExerciseAxes(exerciseId: string, enabled = true) {
  return useQuery<ExerciseAxes>({
    queryKey: authoringKeys.exerciseAxes(exerciseId),
    queryFn: () => call(exerciseId),
    enabled: enabled && !!exerciseId,
  });
}

/**
 * Declare what the exercise trains, or hand it back to the derivation.
 *
 * `null` is the withdrawal (`DELETE`), two empty lists are the declaration that this
 * exercise counts towards nothing (`PUT`). They are different acts and the service keeps
 * them apart, so the mutation does too — collapsing them here would make one of the two
 * unreachable from the UI.
 *
 * Both invalidations matter. The panel needs its own answer back; the coverage strip
 * needs to move, because an override that visibly changes nothing reads as an override
 * that did not save.
 */
export function useSetExerciseAxes(exerciseId: string, containerId?: string) {
  const queryClient = useQueryClient();

  return useMutation<
    ExerciseAxes,
    Error,
    { skills: CoverageSkill[]; focus: CoverageFocus[] } | null
  >({
    mutationFn: (axes) =>
      axes === null
        ? call(exerciseId, { method: 'DELETE' })
        : call(exerciseId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(axes),
          }),
    onSuccess: (axes) => {
      queryClient.setQueryData(authoringKeys.exerciseAxes(exerciseId), axes);
      // Every scope of every container: the exercise may be counted by the module that
      // holds it and by the course above it, and neither key is derivable from here.
      void queryClient.invalidateQueries({ queryKey: authoringKeys.coverageAll() });
      if (containerId) {
        void queryClient.invalidateQueries({ queryKey: authoringKeys.exercises(containerId) });
      }
    },
  });
}

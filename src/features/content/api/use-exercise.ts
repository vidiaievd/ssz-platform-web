'use client';

import { useQueries, useQuery } from '@tanstack/react-query';

import type { ExerciseDisplay, ExerciseWithAnswers } from '../types';
import { contentKeys } from './keys';

async function fetchExerciseForRunner(id: string): Promise<ExerciseWithAnswers> {
  const res = await fetch(`/api/content/exercises/${id}/runner`);
  if (!res.ok) throw new Error('Failed to fetch exercise');
  return res.json() as Promise<ExerciseWithAnswers>;
}

export function useExerciseDisplay(id: string, enabled = true) {
  return useQuery<ExerciseDisplay>({
    queryKey: contentKeys.exercise(id),
    queryFn: async () => {
      const res = await fetch(`/api/content/exercises/${id}`);
      if (!res.ok) throw new Error('Failed to fetch exercise');
      return res.json() as Promise<ExerciseDisplay>;
    },
    staleTime: 300_000,
    enabled: enabled && !!id,
  });
}

/**
 * An exercise as a learner is served it: the published document, plus `expectedAnswers`
 * only for the templates the browser checks (the listening gap-fill and comprehension
 * stages among them — BEHAVIOR.md §7).
 *
 * Deliberately not the authoring route. That one answers with the key for every template
 * and with the author's unpublished draft, which is right for an editor and wrong twice
 * over for a reader; the `/runner` route decides what may travel and withholds the rest.
 * Where nothing is owed, `expectedAnswers` arrives as `{}`.
 */
export function useExerciseForRunner(id: string, enabled = true) {
  return useQuery<ExerciseWithAnswers>({
    queryKey: contentKeys.exerciseForRunner(id),
    queryFn: () => fetchExerciseForRunner(id),
    staleTime: 300_000,
    enabled: enabled && !!id,
  });
}

/** Parallel-fetches several of them, preserving `ids` order (listening stages). */
export function useExercisesForRunner(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: contentKeys.exerciseForRunner(id),
      queryFn: () => fetchExerciseForRunner(id),
      staleTime: 300_000,
    })),
  });
}

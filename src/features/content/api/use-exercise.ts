'use client';

import { useQueries, useQuery } from '@tanstack/react-query';

import type { ExerciseDisplay, ExerciseWithAnswers } from '../types';
import { contentKeys } from './keys';

async function fetchExerciseWithAnswers(id: string): Promise<ExerciseWithAnswers> {
  const res = await fetch(`/api/content/exercises/${id}/answers`);
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
 * Exercise content + expectedAnswers. Same BFF route the authoring editor uses
 * (`/answers`) — the listening gap-fill/comprehension stages grade client-side
 * (BEHAVIOR.md §7), so the reader needs the answer key too, not just `/display`.
 */
export function useExerciseWithAnswers(id: string, enabled = true) {
  return useQuery<ExerciseWithAnswers>({
    queryKey: contentKeys.exerciseAnswers(id),
    queryFn: () => fetchExerciseWithAnswers(id),
    staleTime: 300_000,
    enabled: enabled && !!id,
  });
}

/** Parallel-fetches multiple exercises with answers, preserving `ids` order (listening stages). */
export function useExercisesWithAnswers(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: contentKeys.exerciseAnswers(id),
      queryFn: () => fetchExerciseWithAnswers(id),
      staleTime: 300_000,
    })),
  });
}

'use client';

import { useQuery } from '@tanstack/react-query';

import type { ContainerItem, ExerciseWithAnswers } from '@/features/content/types';

import { authoringKeys } from './keys';

export function useAuthoringExercises(containerId: string, enabled = true) {
  return useQuery<ContainerItem[]>({
    queryKey: authoringKeys.exercises(containerId),
    queryFn: async () => {
      const res = await fetch(`/api/content/containers/${containerId}/items?draft=true`);
      if (!res.ok) throw new Error('Failed to fetch exercises');
      const items: ContainerItem[] = await res.json();
      return items.filter((item) => item.itemType === 'exercise');
    },
    enabled: enabled && !!containerId,
    staleTime: 30_000,
  });
}

export function useAuthoringExercise(exerciseId: string | null, enabled = true) {
  return useQuery<ExerciseWithAnswers | null>({
    queryKey: authoringKeys.exercise(exerciseId ?? ''),
    queryFn: async () => {
      if (!exerciseId) return null;
      // Authoring needs the correct answers to prefill the editor.
      const res = await fetch(`/api/content/exercises/${exerciseId}/answers`);
      if (!res.ok) return null;
      return res.json() as Promise<ExerciseWithAnswers>;
    },
    enabled: enabled && !!exerciseId,
    staleTime: 60_000,
  });
}

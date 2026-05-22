'use client';

import { useQuery } from '@tanstack/react-query';

import type { ContainerItem, ExerciseDisplay } from '@/features/content/types';

import { authoringKeys } from './keys';

export function useAuthoringExercises(containerId: string, enabled = true) {
  return useQuery<ContainerItem[]>({
    queryKey: authoringKeys.exercises(containerId),
    queryFn: async () => {
      const res = await fetch(`/api/content/containers/${containerId}/items?draft=true`);
      if (!res.ok) throw new Error('Failed to fetch exercises');
      const items: ContainerItem[] = await res.json();
      return items.filter((item) => item.contentType === 'EXERCISE');
    },
    enabled: enabled && !!containerId,
    staleTime: 30_000,
  });
}

export function useAuthoringExercise(exerciseId: string | null, enabled = true) {
  return useQuery<ExerciseDisplay | null>({
    queryKey: authoringKeys.exercise(exerciseId ?? ''),
    queryFn: async () => {
      if (!exerciseId) return null;
      const res = await fetch(`/api/content/exercises/${exerciseId}`);
      if (!res.ok) return null;
      return res.json() as Promise<ExerciseDisplay>;
    },
    enabled: enabled && !!exerciseId,
    staleTime: 60_000,
  });
}

'use client';

import { useQuery } from '@tanstack/react-query';

import type { ExerciseDisplay } from '../types';
import { contentKeys } from './keys';

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

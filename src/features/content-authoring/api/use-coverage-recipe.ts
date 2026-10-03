'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CourseCoverageRecipe, Recipe, WorkspaceCoverageRecipe } from '../types';

import { authoringKeys } from './keys';

/** The course's recipe and the workspace's behind it (plan 64, decision O). */
export function useCourseCoverageRecipe(containerId: string) {
  return useQuery<CourseCoverageRecipe>({
    queryKey: authoringKeys.coverageRecipe(containerId),
    queryFn: async () => {
      const res = await fetch(`/api/content/containers/${containerId}/coverage-recipe`);
      if (!res.ok) throw new Error('Failed to read the recipe');
      return res.json() as Promise<CourseCoverageRecipe>;
    },
    enabled: containerId !== '',
    staleTime: 60_000,
  });
}

/** Thrown when the service refused the rules, so the editor can say so instead of "failed". */
export class InvalidRecipeError extends Error {}

/**
 * Saves the course's own recipe — `null` gives it back to the workspace, an empty one opts
 * out. Every coverage report is invalidated: the dots in the tree and the triage rows are
 * the recipe applied to the lessons, and a saved recipe that left them as they were would
 * look like a save that did nothing.
 */
export function useSaveCourseCoverageRecipe(containerId: string) {
  const queryClient = useQueryClient();

  return useMutation<CourseCoverageRecipe, Error, Recipe | null>({
    mutationFn: async (recipe) => {
      const res = await fetch(`/api/content/containers/${containerId}/coverage-recipe`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe }),
      });
      if (res.status === 422) throw new InvalidRecipeError('The recipe was refused');
      if (!res.ok) throw new Error('Failed to save the recipe');
      return res.json() as Promise<CourseCoverageRecipe>;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(authoringKeys.coverageRecipe(containerId), saved);
      void queryClient.invalidateQueries({ queryKey: authoringKeys.coverageAll() });
    },
  });
}

/** The workspace's recipe — `recipe: null` when it was never set (plan 65). */
export function useWorkspaceCoverageRecipe(schoolId: string) {
  return useQuery<WorkspaceCoverageRecipe>({
    queryKey: authoringKeys.workspaceRecipe(schoolId),
    queryFn: async () => {
      const res = await fetch(`/api/content/coverage-recipes/workspaces/${schoolId}`);
      if (!res.ok) throw new Error('Failed to read the recipe');
      return res.json() as Promise<WorkspaceCoverageRecipe>;
    },
    enabled: schoolId !== '',
    staleTime: 60_000,
  });
}

/** Thrown on 403, so the page can turn read-only instead of offering "Try again". */
export class RecipeForbiddenError extends Error {}

/**
 * Saves the workspace's recipe. Every course that inherits it is re-checked by the very
 * next coverage read, so every coverage report is invalidated, and every course recipe
 * too — each of them carries this one as `inherited`.
 */
export function useSaveWorkspaceCoverageRecipe(schoolId: string) {
  const queryClient = useQueryClient();

  return useMutation<WorkspaceCoverageRecipe, Error, Recipe>({
    mutationFn: async (recipe) => {
      const res = await fetch(`/api/content/coverage-recipes/workspaces/${schoolId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe }),
      });
      if (res.status === 422) throw new InvalidRecipeError('The recipe was refused');
      if (res.status === 403) throw new RecipeForbiddenError('Not allowed to change the recipe');
      if (!res.ok) throw new Error('Failed to save the recipe');
      return res.json() as Promise<WorkspaceCoverageRecipe>;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(authoringKeys.workspaceRecipe(schoolId), saved);
      void queryClient.invalidateQueries({ queryKey: authoringKeys.coverageAll() });
      void queryClient.invalidateQueries({ queryKey: authoringKeys.coverageRecipeAll() });
    },
  });
}

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { keyFactory } from '@/lib/query/keys';

import type { CourseReviewSettings, SchoolReviewSettings } from '../types/oversight';

/**
 * The promises, kept apart from the queue's keys.
 *
 * A promise is a setting, not a view of the queue: it changes rarely, is read by two
 * unrelated screens, and must not be swept away by the invalidation that follows every
 * verdict.
 */
export const reviewSettingsKeys = keyFactory('review-settings', {
  school: (school: string) => ['school', school] as const,
  course: (containerId: string) => ['course', containerId] as const,
});

export function useSchoolReviewSettings(school: string) {
  return useQuery<SchoolReviewSettings>({
    queryKey: reviewSettingsKeys.school(school),
    queryFn: async () => {
      const response = await fetch(`/api/schools/${encodeURIComponent(school)}/review-settings`);
      if (!response.ok) throw new Error('Failed to read the response time');
      return response.json() as Promise<SchoolReviewSettings>;
    },
    enabled: school !== '',
    staleTime: 60_000,
  });
}

export function useSaveSchoolReviewSettings(school: string) {
  const queryClient = useQueryClient();

  return useMutation<SchoolReviewSettings, Error, SchoolReviewSettings>({
    mutationFn: async (settings) => {
      const response = await fetch(`/api/schools/${encodeURIComponent(school)}/review-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error('Failed to save the response time');
      return response.json() as Promise<SchoolReviewSettings>;
    },
    onSuccess: (settings) => {
      // The server's own answer, not the draft that was sent: the two differ the moment
      // the service normalises anything, and the field should show what now applies.
      queryClient.setQueryData(reviewSettingsKeys.school(school), settings);
    },
  });
}

export function useCourseReviewSettings(containerId: string) {
  return useQuery<CourseReviewSettings>({
    queryKey: reviewSettingsKeys.course(containerId),
    queryFn: async () => {
      const response = await fetch(`/api/content/containers/${containerId}/review-settings`);
      if (!response.ok) throw new Error('Failed to read the response time');
      return response.json() as Promise<CourseReviewSettings>;
    },
    enabled: containerId !== '',
    staleTime: 60_000,
  });
}

/** `null` hands the promise back to the school (`API_CONTRACT.md` §7). */
export function useSaveCourseReviewSettings(containerId: string) {
  const queryClient = useQueryClient();

  return useMutation<CourseReviewSettings, Error, number | null>({
    mutationFn: async (respondWithinHours) => {
      const response = await fetch(`/api/content/containers/${containerId}/review-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respondWithinHours }),
      });
      if (!response.ok) throw new Error('Failed to save the response time');
      return response.json() as Promise<CourseReviewSettings>;
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(reviewSettingsKeys.course(containerId), settings);
    },
  });
}

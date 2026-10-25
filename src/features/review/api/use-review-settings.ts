'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { keyFactory } from '@/lib/query/keys';

import type {
  CourseReviewAiPolicy,
  CourseReviewAiPolicyInput,
  CourseReviewSettings,
  SchoolReviewAiPolicy,
  SchoolReviewSettings,
} from '../types/oversight';

/**
 * The promises, kept apart from the queue's keys.
 *
 * A promise is a setting, not a view of the queue: it changes rarely, is read by two
 * unrelated screens, and must not be swept away by the invalidation that follows every
 * verdict.
 */
export const reviewSettingsKeys = keyFactory('review-settings', {
  school: (school: string) => ['school', school] as const,
  policy: (school: string) => ['policy', school] as const,
  course: (containerId: string) => ['course', containerId] as const,
  coursePolicy: (containerId: string) => ['course-policy', containerId] as const,
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

/** Why a policy was refused, as the form needs to tell it: the plan, the bounds, or neither. */
export class ReviewPolicySaveError extends Error {
  constructor(
    readonly reason: 'not_entitled' | 'validation' | 'other',
    message?: string,
  ) {
    super(message ?? 'Failed to save the review policy');
  }
}

export function useSchoolReviewPolicy(school: string, enabled = true) {
  return useQuery<SchoolReviewAiPolicy>({
    queryKey: reviewSettingsKeys.policy(school),
    queryFn: async () => {
      const response = await fetch(`/api/schools/${encodeURIComponent(school)}/review-policy`);
      if (!response.ok) throw new Error('Failed to read the review policy');
      return response.json() as Promise<SchoolReviewAiPolicy>;
    },
    enabled: enabled && school !== '',
    staleTime: 60_000,
  });
}

export function useSaveSchoolReviewPolicy(school: string) {
  const queryClient = useQueryClient();

  return useMutation<SchoolReviewAiPolicy, ReviewPolicySaveError, SchoolReviewAiPolicy>({
    mutationFn: async (policy) => {
      const response = await fetch(`/api/schools/${encodeURIComponent(school)}/review-policy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        if (response.status === 403 && body?.error === 'not_entitled') {
          throw new ReviewPolicySaveError('not_entitled');
        }
        throw new ReviewPolicySaveError(response.status === 422 ? 'validation' : 'other');
      }
      return response.json() as Promise<SchoolReviewAiPolicy>;
    },
    onSuccess: (policy) => {
      queryClient.setQueryData(reviewSettingsKeys.policy(school), policy);
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

export function useCourseReviewPolicy(containerId: string, enabled = true) {
  return useQuery<CourseReviewAiPolicy>({
    queryKey: reviewSettingsKeys.coursePolicy(containerId),
    queryFn: async () => {
      const response = await fetch(`/api/content/containers/${containerId}/review-policy`);
      if (!response.ok) throw new Error('Failed to read the course review policy');
      return response.json() as Promise<CourseReviewAiPolicy>;
    },
    enabled: enabled && containerId !== '',
    staleTime: 60_000,
  });
}

/** Set whole, as content-service takes it; the answer is what applies now. */
export function useSaveCourseReviewPolicy(containerId: string) {
  const queryClient = useQueryClient();

  return useMutation<CourseReviewAiPolicy, Error, CourseReviewAiPolicyInput>({
    mutationFn: async (input) => {
      const response = await fetch(`/api/content/containers/${containerId}/review-policy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error('Failed to save the course review policy');
      return response.json() as Promise<CourseReviewAiPolicy>;
    },
    onSuccess: (policy) => {
      queryClient.setQueryData(reviewSettingsKeys.coursePolicy(containerId), policy);
    },
  });
}

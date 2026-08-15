'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CourseReviewQueueResponse,
  ReviewAttemptRequest,
  ReviewAttemptResult,
  ReviewQueueResponse,
} from '@/features/content-authoring/types/review';

import { authoringKeys } from './keys';

/** Everything on this exercise that is waiting on a person, oldest submission first. */
export function useReviewQueue(exerciseId: string, enabled = true) {
  return useQuery<ReviewQueueResponse>({
    queryKey: authoringKeys.reviewQueue(exerciseId),
    queryFn: async () => {
      const res = await fetch(`/api/exercises/${exerciseId}/review-queue`);
      if (!res.ok) throw new Error('Failed to fetch the review queue');
      return res.json() as Promise<ReviewQueueResponse>;
    },
    enabled: enabled && exerciseId !== '',
    // A queue is a live thing: two teachers may be working through it at once, and a
    // stale one offers work that has already been done.
    staleTime: 10_000,
  });
}

/**
 * Everything waiting on a person across a whole course, oldest submission first.
 *
 * The same queue as `useReviewQueue`, asked of the course instead of one exercise: the BFF
 * walks the course tree and merges the queues of every exercise in it, so a teacher sees
 * one list rather than opening each exercise to find out whether anything is in it.
 */
export function useCourseReviewQueue(containerId: string, enabled = true) {
  return useQuery<CourseReviewQueueResponse>({
    queryKey: authoringKeys.courseReviewQueue(containerId),
    queryFn: async () => {
      const res = await fetch(`/api/content/containers/${containerId}/review-queue`);
      if (!res.ok) throw new Error('Failed to fetch the review queue');
      return res.json() as Promise<CourseReviewQueueResponse>;
    },
    enabled: enabled && containerId !== '',
    staleTime: 10_000,
  });
}

export function useReviewAttempt(exerciseId: string) {
  const queryClient = useQueryClient();

  return useMutation<ReviewAttemptResult, Error, { attemptId: string } & ReviewAttemptRequest>({
    mutationFn: async ({ attemptId, ...body }) => {
      const res = await fetch(`/api/exercises/${exerciseId}/attempts/${attemptId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to review this submission');
      return res.json() as Promise<ReviewAttemptResult>;
    },
    // Refetch either way: a submission that could not be marked is one somebody else has
    // already dealt with, and the queue on screen is what is out of date.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: authoringKeys.reviewQueue(exerciseId) });
      // And whichever course inbox was showing it. The card is opened from both screens
      // and knows only its exercise, so every course queue is refetched rather than
      // guessing which courses place this exercise.
      void queryClient.invalidateQueries({ queryKey: authoringKeys.courseReviewQueues() });
    },
  });
}

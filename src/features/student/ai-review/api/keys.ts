import { keyFactory } from '@/lib/query/keys';

/** One review per attempt, read under its exercise. */
export const aiReviewKeys = keyFactory('ai-review', {
  detail: (exerciseId: string, attemptId: string) => ['detail', exerciseId, attemptId] as const,
});

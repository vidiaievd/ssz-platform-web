'use server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { tryAction } from '@/lib/result';

/** Links (or replaces) the comprehension-check exercise for a VIDEO lesson variant (BE1.2). */
export async function setVideoQuestionAction(
  lessonId: string,
  variantId: string,
  exerciseId: string,
) {
  return tryAction(async () => {
    return serverFetch<{ questionId: string }>({
      service: 'content',
      path: `/lessons/${lessonId}/variants/${variantId}/comprehension-question`,
      method: 'PUT',
      body: { exerciseId },
    });
  });
}

/** Unlinks the comprehension-check exercise from a VIDEO lesson variant, if any. */
export async function clearVideoQuestionAction(lessonId: string, variantId: string) {
  return tryAction(async () => {
    await serverFetch({
      service: 'content',
      path: `/lessons/${lessonId}/variants/${variantId}/comprehension-question`,
      method: 'DELETE',
    });
  });
}

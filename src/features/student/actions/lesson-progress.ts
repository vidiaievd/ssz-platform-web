'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { tryAction } from '@/lib/result';

async function upsertProgress(contentId: string, timeSpentSeconds: number, completed: boolean) {
  await serverFetch({
    service: 'progress',
    path: '/progress',
    method: 'POST',
    body: { contentType: 'LESSON', contentId, timeSpentSeconds, completed },
  });
}

/** Flips status NOT_STARTED → IN_PROGRESS. No time has elapsed yet, so 0 is correct. */
export async function markLessonStartedAction(lessonId: string) {
  return tryAction(async () => {
    await upsertProgress(lessonId, 0, false);
    return { lessonId, status: 'started' as const };
  });
}

export async function markLessonCompletedAction(lessonId: string, timeSpentSeconds: number) {
  return tryAction(async () => {
    await upsertProgress(lessonId, Math.max(0, Math.round(timeSpentSeconds)), true);
    revalidatePath('/student/dashboard');
    return { lessonId, status: 'completed' as const };
  });
}

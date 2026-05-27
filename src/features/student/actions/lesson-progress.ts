'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { tryAction } from '@/lib/result';

async function recordProgressEvent(contentId: string, event: 'started' | 'completed') {
  await serverFetch({
    service: 'progress',
    path: '/progress',
    method: 'POST',
    body: { contentId, contentType: 'LESSON', event },
  });
}

export async function markLessonStartedAction(lessonId: string) {
  return tryAction(async () => {
    await recordProgressEvent(lessonId, 'started');
    return { lessonId, status: 'started' as const };
  });
}

export async function markLessonCompletedAction(lessonId: string) {
  return tryAction(async () => {
    await recordProgressEvent(lessonId, 'completed');
    revalidatePath('/student/enrolled');
    return { lessonId, status: 'completed' as const };
  });
}

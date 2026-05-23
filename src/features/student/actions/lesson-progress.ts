'use server';

import { revalidatePath } from 'next/cache';

import { tryAction } from '@/lib/result';

export async function markLessonStartedAction(lessonId: string) {
  return tryAction(async () => {
    // Stub until the Progress service is available.
    // Replace with: serverFetch({ service: 'progress', path: '/api/v1/progress', method: 'POST', body: { lessonId, event: 'started' } })
    return { lessonId, status: 'started' as const };
  });
}

export async function markLessonCompletedAction(lessonId: string) {
  return tryAction(async () => {
    // Stub until the Progress service is available.
    // Replace with: serverFetch({ service: 'progress', path: '/api/v1/progress', method: 'POST', body: { lessonId, event: 'completed' } })
    revalidatePath('/student/enrolled');
    return { lessonId, status: 'completed' as const };
  });
}

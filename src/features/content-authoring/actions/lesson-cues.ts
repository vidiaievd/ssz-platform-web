'use server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';

import { videoCuesSchema, type VideoCueEntry } from '../schemas/lesson';

/** Full replacement, mirroring the backend's replace-all semantics (BE1.2). */
export async function saveLessonCuesAction(
  lessonId: string,
  variantId: string,
  cues: VideoCueEntry[],
) {
  return tryAction(async () => {
    const parsed = videoCuesSchema.safeParse(cues);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten((i) => i.message));
    }

    await serverFetch({
      service: 'content',
      path: `/lessons/${lessonId}/variants/${variantId}/cues`,
      method: 'POST',
      body: { cues: parsed.data },
    });
  });
}

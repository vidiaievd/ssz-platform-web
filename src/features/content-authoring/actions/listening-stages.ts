'use server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';

import { listeningStagesSchema, type ListeningStageEntry } from '../schemas/lesson';

/** Full replacement, mirroring the backend's replace-all semantics (BE1.3). */
export async function saveListeningStagesAction(
  lessonId: string,
  variantId: string,
  stages: ListeningStageEntry[],
) {
  return tryAction(async () => {
    const parsed = listeningStagesSchema.safeParse(stages);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten((i) => i.message));
    }

    await serverFetch({
      service: 'content',
      path: `/lessons/${lessonId}/variants/${variantId}/listening-stages`,
      method: 'POST',
      body: { stages: parsed.data },
    });
  });
}

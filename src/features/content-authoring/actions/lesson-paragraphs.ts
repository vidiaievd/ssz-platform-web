'use server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';

import { paragraphTranslationsSchema, type ParagraphTranslationEntry } from '../schemas/lesson';

/** Full replacement, mirroring the backend's replace-all semantics (BE1.4). */
export async function saveParagraphTranslationsAction(
  lessonId: string,
  variantId: string,
  translations: ParagraphTranslationEntry[],
) {
  return tryAction(async () => {
    const parsed = paragraphTranslationsSchema.safeParse(translations);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten((i) => i.message));
    }

    await serverFetch({
      service: 'content',
      path: `/lessons/${lessonId}/variants/${variantId}/paragraphs`,
      method: 'POST',
      body: { translations: parsed.data },
    });
  });
}

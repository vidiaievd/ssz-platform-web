'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';
import type { DifficultyLevel, Visibility } from '@/features/content/types';
import type { MaterialKind } from '@/lib/content/lesson-types';

import { lessonFormSchema, type LessonFormValues } from '../schemas/lesson';
import { addItemToDraft, removeItemFromDraft, reorderDraftItems } from '../lib/container-items';

/** `MaterialKind`s backed by a `Lesson` entity (`kind` distinguishes them server-side). */
export type LessonKind = Extract<MaterialKind, 'text' | 'video' | 'audio' | 'live'>;

export async function createLessonAction(
  containerId: string,
  targetLanguage: string,
  difficultyLevel: DifficultyLevel,
  visibility: Visibility,
  input: LessonFormValues,
  kind: LessonKind = 'text',
) {
  return tryAction(async () => {
    const parsed = lessonFormSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten((i) => i.message));
    }
    const { title, body, transcript } = parsed.data;

    const { lessonId } = await serverFetch<{ lessonId: string }>({
      service: 'content',
      path: '/lessons',
      method: 'POST',
      body: { title, targetLanguage, difficultyLevel, visibility, kind },
    });

    let variantId: string | undefined;
    if (body) {
      const variant = await serverFetch<{ variantId: string }>({
        service: 'content',
        path: `/lessons/${lessonId}/variants`,
        method: 'POST',
        body: {
          explanationLanguage: 'en',
          minLevel: difficultyLevel,
          maxLevel: difficultyLevel,
          displayTitle: title,
          bodyMarkdown: body,
          ...(transcript !== undefined && { transcript }),
        },
      });
      variantId = variant.variantId;
    }

    const item = await addItemToDraft(containerId, 'lesson', lessonId);

    revalidatePath(`/school/content/${containerId}`);
    return { lessonId, variantId, itemId: item.id };
  });
}

export async function updateLessonAction(
  lessonId: string,
  containerId: string,
  variantId: string | null,
  difficultyLevel: DifficultyLevel,
  input: LessonFormValues,
) {
  return tryAction(async () => {
    const parsed = lessonFormSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten((i) => i.message));
    }
    const { title, body, transcript } = parsed.data;

    await serverFetch({
      service: 'content',
      path: `/lessons/${lessonId}`,
      method: 'PATCH',
      body: { title },
    });

    let newVariantId: string | undefined;
    if (body !== undefined || transcript !== undefined) {
      if (variantId) {
        await serverFetch({
          service: 'content',
          path: `/lessons/${lessonId}/variants/${variantId}`,
          method: 'PATCH',
          body: {
            displayTitle: title,
            ...(body !== undefined && { bodyMarkdown: body }),
            ...(transcript !== undefined && { transcript }),
          },
        });
      } else if (body) {
        const variant = await serverFetch<{ variantId: string }>({
          service: 'content',
          path: `/lessons/${lessonId}/variants`,
          method: 'POST',
          body: {
            explanationLanguage: 'en',
            minLevel: difficultyLevel,
            maxLevel: difficultyLevel,
            displayTitle: title,
            bodyMarkdown: body,
            ...(transcript !== undefined && { transcript }),
          },
        });
        newVariantId = variant.variantId;
      }
    }

    revalidatePath(`/school/content/${containerId}`);
    return { variantId: newVariantId };
  });
}

export async function deleteLessonAction(
  containerItemId: string,
  lessonId: string,
  containerId: string,
) {
  return tryAction(async () => {
    await removeItemFromDraft(containerId, containerItemId);
    await serverFetch({
      service: 'content',
      path: `/lessons/${lessonId}`,
      method: 'DELETE',
    });
    revalidatePath(`/school/content/${containerId}`);
  });
}

export async function reorderLessonsAction(containerId: string, orderedItemIds: string[]) {
  return tryAction(async () => {
    await reorderDraftItems(containerId, orderedItemIds);
  });
}

'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';
import type { Lesson, LessonVariant, ContainerVersion } from '@/features/content/types';

import { lessonFormSchema, type LessonFormValues } from '../schemas/lesson';

async function getDraftVersionId(containerId: string): Promise<string | null> {
  try {
    const versions = await serverFetch<ContainerVersion[]>({
      service: 'content',
      path: `/containers/${containerId}/versions`,
    });
    return versions.find((v) => !v.isPublished)?.id ?? null;
  } catch {
    return null;
  }
}

export async function createLessonAction(
  containerId: string,
  targetLanguage: string,
  input: LessonFormValues,
) {
  return tryAction(async () => {
    const parsed = lessonFormSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten());
    }
    const { title, body } = parsed.data;

    const lesson = await serverFetch<Lesson>({
      service: 'content',
      path: '/lessons',
      method: 'POST',
      body: { title, targetLanguage, containerId },
    });

    let variantId: string | undefined;
    if (body) {
      const variant = await serverFetch<LessonVariant>({
        service: 'content',
        path: `/lessons/${lesson.id}/variants`,
        method: 'POST',
        body: { title, body, targetLanguage },
      });
      variantId = variant.id;
    }

    revalidatePath(`/school/content/${containerId}`);
    return { lesson, variantId };
  });
}

export async function updateLessonAction(
  lessonId: string,
  containerId: string,
  variantId: string | null,
  targetLanguage: string,
  input: LessonFormValues,
) {
  return tryAction(async () => {
    const parsed = lessonFormSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten());
    }
    const { title, body } = parsed.data;

    await serverFetch({
      service: 'content',
      path: `/lessons/${lessonId}`,
      method: 'PATCH',
      body: { title },
    });

    if (body !== undefined) {
      if (variantId) {
        await serverFetch({
          service: 'content',
          path: `/lessons/${lessonId}/variants/${variantId}`,
          method: 'PATCH',
          body: { body, title },
        });
      } else {
        await serverFetch<LessonVariant>({
          service: 'content',
          path: `/lessons/${lessonId}/variants`,
          method: 'POST',
          body: { title, body, targetLanguage },
        });
      }
    }

    revalidatePath(`/school/content/${containerId}`);
  });
}

export async function deleteLessonAction(lessonId: string, containerId: string) {
  return tryAction(async () => {
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
    const versionId = await getDraftVersionId(containerId);
    if (!versionId) {
      throw new AppError('not_found', 'No draft version found for container');
    }
    await serverFetch({
      service: 'content',
      path: `/containers/${containerId}/versions/${versionId}/items/reorder`,
      method: 'PUT',
      body: { orderedIds: orderedItemIds },
    });
  });
}

'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';
import type { Container } from '@/features/content/types';

import { containerFormSchema, type ContainerFormValues } from '../schemas/container';

export async function createContainerAction(input: ContainerFormValues) {
  return tryAction(async () => {
    const parsed = containerFormSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten((i) => i.message));
    }

    const data = parsed.data;

    const container = await serverFetch<Container>({
      service: 'content',
      path: '/containers',
      method: 'POST',
      body: {
        title: data.title,
        ...(data.description && { description: data.description }),
        containerType: data.containerType,
        targetLanguage: data.targetLanguage,
        difficultyLevel: data.difficultyLevel,
        visibility: data.visibility,
        accessTier: data.accessTier,
      },
    });

    revalidatePath('/school/content');
    return container;
  });
}

export async function updateContainerAction(id: string, input: ContainerFormValues) {
  return tryAction(async () => {
    const parsed = containerFormSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten((i) => i.message));
    }

    const data = parsed.data;
    // containerType cannot be changed after creation — not sent on update.
    const body: Record<string, unknown> = {
      title: data.title,
      description: data.description ?? null,
      difficultyLevel: data.difficultyLevel,
      visibility: data.visibility,
      accessTier: data.accessTier,
    };

    await serverFetch({
      service: 'content',
      path: `/containers/${id}`,
      method: 'PATCH',
      body,
    });

    revalidatePath('/school/content');
    revalidatePath(`/school/content/${id}`);
  });
}

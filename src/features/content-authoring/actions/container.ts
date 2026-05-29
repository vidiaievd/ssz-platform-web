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
    if (!data.slug) {
      throw new AppError('validation', 'Slug is required', {
        fieldErrors: { slug: ['Slug is required'] },
        formErrors: [],
      });
    }

    const container = await serverFetch<Container>({
      service: 'content',
      path: '/containers',
      method: 'POST',
      body: {
        title: data.title,
        ...(data.description && { description: data.description }),
        type: data.type,
        targetLanguage: data.targetLanguage,
        ...(data.instructionLanguage && { instructionLanguage: data.instructionLanguage }),
        ...(data.level && { level: data.level }),
        slug: data.slug,
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
    const body: Record<string, unknown> = {
      title: data.title,
      description: data.description ?? null,
      type: data.type,
      targetLanguage: data.targetLanguage,
      instructionLanguage: data.instructionLanguage ?? null,
      level: data.level ?? null,
      accessTier: data.accessTier,
    };
    // Only send slug for drafts; for published containers the field is read-only in the UI.
    if (data.slug !== undefined) body.slug = data.slug;

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

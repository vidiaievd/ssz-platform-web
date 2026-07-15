'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';
import type { AccessTier, Container, DifficultyLevel, Visibility } from '@/features/content/types';

import { containerFormSchema, type ContainerFormValues } from '../schemas/container';
import { addItemToDraft, assignItemSection } from '../lib/container-items';

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

/**
 * Creates a module (a `Container(containerType=module)`) and attaches it to
 * the course's draft version as a `container`-type item, optionally assigned
 * to a level (a section on the course container). Used by the curriculum
 * tree's "Add module" affordance.
 */
export async function createModuleAction(
  courseContainerId: string,
  title: string,
  targetLanguage: string,
  difficultyLevel: DifficultyLevel,
  visibility: Visibility,
  accessTier: AccessTier,
  levelSectionId?: string | null,
) {
  return tryAction(async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      throw new AppError('validation', 'Invalid input', { title: ['Required'] });
    }

    const module_ = await serverFetch<Container>({
      service: 'content',
      path: '/containers',
      method: 'POST',
      body: {
        title: trimmed,
        containerType: 'module',
        targetLanguage,
        difficultyLevel,
        visibility,
        accessTier,
      },
    });

    const item = await addItemToDraft(courseContainerId, 'container', module_.id);
    if (levelSectionId) {
      await assignItemSection(courseContainerId, item.id, levelSectionId);
    }

    revalidatePath(`/school/content/${courseContainerId}`);
    return { moduleContainerId: module_.id, itemId: item.id };
  });
}

/** Renames a container (e.g. a module) without touching its other fields — used by the curriculum-tree Inspector. */
export async function renameContainerAction(id: string, title: string) {
  return tryAction(async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      throw new AppError('validation', 'Invalid input', { title: ['Required'] });
    }

    await serverFetch({
      service: 'content',
      path: `/containers/${id}`,
      method: 'PATCH',
      body: { title: trimmed },
    });

    revalidatePath(`/school/content/${id}`);
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

'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';
import type { ContainerShare, ShareRole } from '@/features/content/types';

export async function addShareAction(
  entityType: string,
  entityId: string,
  email: string,
  role: ShareRole,
) {
  return tryAction(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) throw new AppError('validation', 'Email is required');

    const share = await serverFetch<ContainerShare>({
      service: 'content',
      path: '/shares',
      method: 'POST',
      body: { entityType, entityId, email: trimmed, role },
    });

    if (entityType === 'container') revalidatePath(`/school/content/${entityId}`);
    return share;
  });
}

export async function removeShareAction(
  shareId: string,
  entityType: string,
  entityId: string,
) {
  return tryAction(async () => {
    await serverFetch({
      service: 'content',
      path: `/shares/${shareId}`,
      method: 'DELETE',
    });

    if (entityType === 'container') revalidatePath(`/school/content/${entityId}`);
  });
}

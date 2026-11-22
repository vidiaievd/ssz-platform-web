'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';
import type { ShareRole } from '@/features/content/types';

import { shareRoleToPermission } from '../lib/share-mapping';

interface ContentShareResponse {
  id: string;
  entityType: string;
  entityId: string;
  sharedWithUserId: string;
  permission: string;
}

export async function addShareAction(
  entityType: string,
  entityId: string,
  email: string,
  role: ShareRole,
) {
  return tryAction(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) throw new AppError('validation', 'Email is required');

    // content-service resolves the address itself, after checking that the caller may share this
    // material, and counts the lookup against the caller (plan 90, session 16 remark 4) — there is
    // no public address lookup. No account → 404 (`not_found`), over the limit → 429 (`rate_limited`).
    const share = await serverFetch<ContentShareResponse>({
      service: 'content',
      path: '/content-shares/by-email',
      method: 'POST',
      body: {
        entityType,
        entityId,
        email: trimmed,
        permission: shareRoleToPermission(role),
      },
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
      path: `/content-shares/${shareId}`,
      method: 'DELETE',
    });

    if (entityType === 'container') revalidatePath(`/school/content/${entityId}`);
  });
}

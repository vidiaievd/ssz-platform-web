'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';
import type { ShareRole } from '@/features/content/types';

import { shareRoleToPermission } from '../lib/share-mapping';

interface UserLookupResult {
  userId: string;
  roles: string[];
  displayName?: string;
}

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

    // The content-share endpoint only accepts a userId — resolve the invitee's
    // email to a userId via profile-service first.
    let lookup: UserLookupResult;
    try {
      lookup = await serverFetch<UserLookupResult>({
        service: 'profile',
        path: '/users/lookup',
        query: { email: trimmed },
      });
    } catch (e) {
      if (e instanceof AppError && e.code === 'not_found') {
        throw new AppError('not_found', 'No user found with that email');
      }
      throw e;
    }

    const share = await serverFetch<ContentShareResponse>({
      service: 'content',
      path: '/content-shares',
      method: 'POST',
      body: {
        entityType,
        entityId,
        sharedWithUserId: lookup.userId,
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

'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { tryAction } from '@/lib/result';

/**
 * What the school page changes. `null` clears an optional field (organization keeps a value it
 * is not sent, and stores `null` for one sent as `null`).
 */
export interface SchoolProfilePatch {
  name?: string;
  description?: string;
  avatarUrl?: string | null;
  website?: string | null;
  contactEmail?: string | null;
  city?: string | null;
}

/** `PATCH schools/:id` (owner / admin). A suspended or closed school answers 409 `SCHOOL_NOT_ACTIVE`. */
export async function updateSchoolProfileAction(schoolId: string, patch: SchoolProfilePatch) {
  return tryAction(async () => {
    await serverFetch({
      service: 'organization',
      path: `/schools/${schoolId}`,
      method: 'PATCH',
      body: patch,
    });
    // Name and logo show in the workspace shell (sidebar, switcher).
    revalidatePath('/[locale]/w/[workspaceId]', 'layout');
  });
}

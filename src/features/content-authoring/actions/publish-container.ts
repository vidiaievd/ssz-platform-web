'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { tryAction } from '@/lib/result';
import { requireDraftVersionId } from '@/features/content-authoring/lib/container-items';

export async function publishContainerAction(containerId: string, changelog?: string) {
  return tryAction(async () => {
    const versionId = await requireDraftVersionId(containerId);
    const notes = changelog?.trim();
    await serverFetch<unknown, { changelog?: string }>({
      service: 'content',
      path: `/containers/${containerId}/versions/${versionId}/publish`,
      method: 'POST',
      body: notes ? { changelog: notes } : {},
    });

    // Publishing consumes the draft, and every write path in the editor —
    // adding a lesson, reordering, renaming — resolves the draft version first.
    // Without opening the next one the author is left with a read-only editor
    // and no way out of it, since nothing in the UI creates a draft.
    // The endpoint returns the existing draft if one somehow survived.
    try {
      await serverFetch<{ versionId: string }>({
        service: 'content',
        path: `/containers/${containerId}/draft`,
        method: 'POST',
      });
    } catch (err) {
      // The publish itself succeeded; report that rather than failing the
      // action, and let the author retry through the editor.
      console.error('[publishContainerAction] next draft not created:', err);
    }

    revalidatePath(`/school/content/${containerId}`);
    revalidatePath('/school/content');
  });
}

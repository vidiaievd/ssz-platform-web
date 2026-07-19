'use server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { tryAction } from '@/lib/result';
import type { GlossaryMark } from '@/features/content/types';

/**
 * Marks a vocabulary item as introduced by this lesson variant (BE1.5). No
 * span/position is stored — the association is by `vocabularyItemId` only.
 * Repeat marks of the same word increment `occurrenceCount` server-side;
 * there is no unmark endpoint.
 */
export async function markGlossaryWordAction(
  lessonId: string,
  variantId: string,
  vocabularyItemId: string,
) {
  return tryAction(async () => {
    return serverFetch<GlossaryMark>({
      service: 'content',
      path: `/lessons/${lessonId}/variants/${variantId}/glossary-marks`,
      method: 'POST',
      body: { vocabularyItemId },
    });
  });
}

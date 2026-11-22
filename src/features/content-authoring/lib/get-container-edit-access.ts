import 'server-only';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

/**
 * Whether the caller may edit this course, as content-service decides it (plan 90, Q17 (a)):
 * the author, a co-author with an edit share, or the school's owner / content admin — and only
 * while the owning school is active (a suspended or closed school answers 409 `SCHOOL_NOT_ACTIVE`).
 *
 * Only decides what the screen offers. A failure to ask is not a refusal: the editor stays open
 * and content-service refuses the write itself, as before.
 */
export async function canEditContainer(containerId: string): Promise<boolean> {
  try {
    await serverFetch<{ canEdit: true }>({ service: 'content', path: `/containers/${containerId}/edit-access` });
    return true;
  } catch (e) {
    if (e instanceof AppError && (e.code === 'forbidden' || e.code === 'conflict' || e.code === 'not_found')) {
      return false;
    }
    console.error('[content] edit-access check failed:', e);
    return true;
  }
}

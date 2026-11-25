'use client';

import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { useNavHistoryStore } from '@/stores/nav-history-store';

/**
 * The page under a route modal: the modal's URL less its last segment
 * (`…/groups/<id>/assign-teacher` → `…/groups/<id>`).
 */
export function parentPath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  const cut = trimmed.lastIndexOf('/');
  return cut > 0 ? trimmed.slice(0, cut) : '/';
}

/**
 * Closes a group route modal (`@modals/assign-teacher`, `@modals/add-students`).
 * Opened from inside the app, it goes back, so the modal's entry leaves the history.
 * Opened by a direct link or after a reload, there is no in-app entry behind it —
 * `router.back()` would leave the app (a new tab goes to `about:blank`) — so it
 * replaces the modal's URL with the group page instead.
 */
export function useCloseGroupModal(): () => void {
  const router = useRouter();
  const pathname = usePathname();
  const previousPath = useNavHistoryStore((s) => s.previousPath);

  return useCallback(() => {
    if (previousPath !== null) router.back();
    else router.replace(parentPath(pathname));
  }, [previousPath, router, pathname]);
}

'use client';

import { useEffect, useRef } from 'react';

import { usePathname } from '@/lib/i18n/navigation';
import { useNavHistoryStore } from '@/stores/nav-history-store';

const ACCOUNT_PREFIX = '/account';

/**
 * Records the path the user was on right before entering `/account/*`.
 *
 * Uses next-intl `usePathname` (locale-agnostic) so the captured path has no
 * `/en` prefix and can be pushed back through the locale-aware router cleanly.
 *
 * Survives client-side navigation (unlike `document.referrer`) and refreshes
 * (the target is persisted to sessionStorage by the store).
 */
export function NavigationHistoryTracker() {
  const pathname = usePathname();
  const setReturnPath = useNavHistoryStore((s) => s.setReturnPath);
  const prevRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    const isAccount = pathname.startsWith(ACCOUNT_PREFIX);
    const wasAccount = prev?.startsWith(ACCOUNT_PREFIX) ?? false;

    if (isAccount && !wasAccount && prev !== null) {
      // Entered the account section from an external page — remember it.
      setReturnPath(prev);
    } else if (!isAccount) {
      // Outside the account section — the stored return path is stale.
      setReturnPath(null);
    }
    // Entering account on first load (prev === null) leaves the persisted
    // value untouched, so a refresh inside /account keeps the return target.

    prevRef.current = pathname;
  }, [pathname, setReturnPath]);

  return null;
}

'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { SCHOOL_NOT_ACTIVE_EVENT } from '../types';

/**
 * Tells a learner why starting or handing in work was refused (plan 90, phase 5). The attempt
 * calls live in some twenty exercise runners, each with its own error handling; they all go
 * through one `fetch` wrapper, which raises an event, and this one listener words it — so a
 * refusal is never a silent failure or the runner's generic "something went wrong".
 */
export function SchoolNotActiveNotice() {
  const t = useTranslations('SchoolLifecycle.errors');

  useEffect(() => {
    function onRefused(event: Event) {
      const status = (event as CustomEvent<{ status?: string }>).detail?.status;
      toast.error(status === 'closed' ? t('schoolClosed') : t('schoolSuspended'), { id: 'school-not-active' });
    }
    window.addEventListener(SCHOOL_NOT_ACTIVE_EVENT, onRefused);
    return () => window.removeEventListener(SCHOOL_NOT_ACTIVE_EVENT, onRefused);
  }, [t]);

  return null;
}

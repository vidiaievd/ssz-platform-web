'use client';

import { useTranslations } from 'next-intl';

import { lifecycleErrorKeyOf } from '@/features/school-lifecycle/lib/lifecycle-errors';

import type { AppErrorCode } from './app-error';

/** What a failed server action hands back: the code, plus the upstream body in `details`. */
export type ErrorLike = { code: AppErrorCode; details?: unknown };

/**
 * Message for a failed action. A refusal because the school is read only (409 `SCHOOL_NOT_ACTIVE`)
 * or the course is retired (409 `COURSE_OBSOLETE`) gets its own text; everything else falls back
 * to the generic text of its `AppErrorCode`. A bare code (`'unknown'`) goes straight to the fallback.
 */
export function useErrorMessage(): (error: ErrorLike | AppErrorCode) => string {
  const tErrors = useTranslations('Errors');
  const tLifecycle = useTranslations('SchoolLifecycle.errors');

  return (error) => {
    if (typeof error === 'string') return tErrors(error);
    const key = lifecycleErrorKeyOf(error);
    return key ? tLifecycle(key) : tErrors(error.code);
  };
}

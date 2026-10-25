'use client';

import { useTranslations } from 'next-intl';

import type { ReviewBlockResult } from '../api/review-block-actions';

/**
 * A refusal from scheduling in the teacher's words.
 *
 * Explicit branches rather than a key built from the code: a template key makes next-intl's
 * types expand every message path, and an unknown code falls back to the caller's own line
 * instead of a missing-message warning.
 *
 * `forTeacher` — the school is holding somebody else's time, so a refusal about "who marks
 * here" is about them, not about the person reading it.
 */
export function useReviewBlockError(forTeacher = false) {
  const t = useTranslations('Scheduling.my.reviewBlocks.errors');

  return (result: Extract<ReviewBlockResult, { ok: false }>, fallback: string): string => {
    switch (result.code) {
      case 'END_TIME_NOT_AFTER_START':
        return t('endTimeNotAfterStart');
      case 'ENDS_BEFORE_START':
        return t('endsBeforeStart');
      case 'ONE_OFF_SPANS_DAYS':
        return t('oneOffSpansDays');
      case 'INVALID_TIME':
        return t('invalidTime');
      case 'TARGET_NOT_REVIEWER':
        return forTeacher ? t('targetNotReviewerForTeacher') : t('targetNotReviewer');
      case 'ONE_OFF_CANNOT_SKIP':
        return t('oneOffCannotSkip');
      case 'NOT_AN_OCCURRENCE':
        return t('notAnOccurrence');
      default:
        return fallback;
    }
  };
}

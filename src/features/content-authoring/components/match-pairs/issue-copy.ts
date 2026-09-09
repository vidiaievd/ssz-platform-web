'use client';

import { useTranslations } from 'next-intl';

import type { Issue } from '@/lib/shared-kernel/match-pairs';

/**
 * Turns a validation code into a sentence in the teacher's language.
 *
 * The kernel deliberately carries codes and parameters and no prose: the same document
 * is judged on the server, where there is no locale, and the builder is translated into
 * four languages. This is the renderer that side of the line.
 */
export function useIssueCopy(): (issue: Issue) => string {
  const t = useTranslations('Authoring');

  return (issue: Issue): string => {
    switch (issue.code) {
      // Not rendered in the gate: the platform has no title on an exercise, so the
      // builder and container pre-flight both drop this code. Handled to stay total.
      case 'EX_NO_TITLE':
        return t('matchPairs.issues.EX_NO_TITLE');
      case 'PAIR_HALF_EMPTY':
        return t('matchPairs.issues.PAIR_HALF_EMPTY', { index: issue.pairIndex + 1 });
      case 'EX_TOO_FEW_PAIRS':
        return t('matchPairs.issues.EX_TOO_FEW_PAIRS', {
          count: issue.pairCount,
          required: issue.required,
        });
      case 'PAIR_LEFT_DUPLICATE':
        return t('matchPairs.issues.PAIR_LEFT_DUPLICATE', { index: issue.pairIndex + 1 });
      case 'PAIR_RIGHT_LONG':
        return t('matchPairs.issues.PAIR_RIGHT_LONG', {
          index: issue.pairIndex + 1,
          count: issue.wordCount,
        });
      case 'POOL_DUPLICATE':
        return t('matchPairs.issues.POOL_DUPLICATE', { text: issue.text });
      case 'POOL_NO_DISTRACTORS':
        return t('matchPairs.issues.POOL_NO_DISTRACTORS');
      case 'POOL_TOO_SMALL':
        return t('matchPairs.issues.POOL_TOO_SMALL', { count: issue.pairCount });
      case 'FB_NO_DEFAULT':
        return t('matchPairs.issues.FB_NO_DEFAULT', { index: issue.pairIndex + 1 });
    }
  };
}

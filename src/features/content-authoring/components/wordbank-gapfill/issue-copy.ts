'use client';

import { useTranslations } from 'next-intl';

import type { Issue } from '@/lib/shared-kernel/wordbank-gapfill';

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
      // Not rendered: the platform has no title on an exercise, so the builder and
      // container pre-flight both drop this code. Handled to keep the switch total.
      case 'EX_NO_TITLE':
        return t('gapFill.issues.EX_NO_TITLE');
      case 'EX_NO_SENTENCES':
        return t('gapFill.issues.EX_NO_SENTENCES');
      case 'SENT_EMPTY':
        return t('gapFill.issues.SENT_EMPTY', { index: issue.sentenceIndex + 1 });
      case 'SENT_NO_GAP':
        return t('gapFill.issues.SENT_NO_GAP', { index: issue.sentenceIndex + 1 });
      case 'BANK_DUPLICATE':
        return t('gapFill.issues.BANK_DUPLICATE', { word: issue.word });
      case 'BANK_TOO_FEW':
        return t('gapFill.issues.BANK_TOO_FEW', { bankSize: issue.bankSize });
      case 'BANK_TOO_SMALL':
        return t('gapFill.issues.BANK_TOO_SMALL', {
          bankSize: issue.bankSize,
          gapCount: issue.gapCount,
        });
      case 'FB_PAIRS_UNUSED':
        return t('gapFill.issues.FB_PAIRS_UNUSED', { count: issue.pairCount });
      case 'FB_NO_FALLBACK':
        return t('gapFill.issues.FB_NO_FALLBACK', { label: issue.label });
      case 'FB_NO_WHY':
        return t('gapFill.issues.FB_NO_WHY', { label: issue.label });
      case 'FB_PARTIAL_COVERAGE':
        return t('gapFill.issues.FB_PARTIAL_COVERAGE', {
          written: issue.written,
          total: issue.total,
        });
    }
  };
}

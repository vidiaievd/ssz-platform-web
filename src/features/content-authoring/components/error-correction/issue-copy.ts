'use client';

import { useTranslations } from 'next-intl';

import type { Issue } from '@/lib/shared-kernel/error-correction';

/**
 * Turns a validation code into a sentence in the teacher's language.
 *
 * The kernel deliberately carries codes and parameters and no prose: the same document
 * is judged on the server, where there is no locale, and the builder is translated into
 * four languages. This is the renderer that side of the line — the same contract as
 * `wordbank-gapfill/issue-copy.ts`.
 */
export function useIssueCopy(): (issue: Issue) => string {
  const t = useTranslations('Authoring');

  return (issue: Issue): string => {
    switch (issue.code) {
      case 'EX_NO_INSTRUCTION':
        return t('errorCorrection.issues.EX_NO_INSTRUCTION');
      case 'PASSAGE_MANY_ITEMS':
        return t('errorCorrection.issues.PASSAGE_MANY_ITEMS', { count: issue.itemCount });
      case 'EX_NO_ITEMS':
        return t('errorCorrection.issues.EX_NO_ITEMS');
      case 'ITEM_NO_REF':
        return t('errorCorrection.issues.ITEM_NO_REF', { index: issue.itemIndex + 1 });
      case 'ITEM_IDENTICAL':
        return t('errorCorrection.issues.ITEM_IDENTICAL', { index: issue.itemIndex + 1 });
      case 'ITEM_ALL_SOFT':
        return t('errorCorrection.issues.ITEM_ALL_SOFT', { index: issue.itemIndex + 1 });
      case 'ITEM_MANY_ERRORS':
        return t('errorCorrection.issues.ITEM_MANY_ERRORS', {
          index: issue.itemIndex + 1,
          count: issue.errorCount,
        });
      case 'ITEM_TOO_LONG':
        return t('errorCorrection.issues.ITEM_TOO_LONG', {
          index: issue.itemIndex + 1,
          count: issue.wordCount,
        });
      case 'SPAN_ORDER_TOO_WIDE':
        return t('errorCorrection.issues.SPAN_ORDER_TOO_WIDE', {
          index: issue.itemIndex + 1,
          count: issue.width,
        });
      case 'ITEM_ALT_EQUALS_WRONG':
        return t('errorCorrection.issues.ITEM_ALT_EQUALS_WRONG', { index: issue.itemIndex + 1 });
      case 'ITEM_COUNT_HIDDEN':
        return t('errorCorrection.issues.ITEM_COUNT_HIDDEN', {
          index: issue.itemIndex + 1,
          count: issue.errorCount,
        });
      case 'CHECK_IGNORE_PUNCT':
        return t('errorCorrection.issues.CHECK_IGNORE_PUNCT');
      case 'CHECK_CASE_INSENSITIVE':
        return t('errorCorrection.issues.CHECK_CASE_INSENSITIVE');
      case 'CHECK_STRAY_IGNORED':
        return t('errorCorrection.issues.CHECK_STRAY_IGNORED');
      case 'CHECK_NEAR_TOO_LOW':
        return t('errorCorrection.issues.CHECK_NEAR_TOO_LOW', {
          percent: Math.round(issue.near * 100),
        });
      case 'HINT_TYPE_WITHOUT_COUNT':
        return t('errorCorrection.issues.HINT_TYPE_WITHOUT_COUNT');
      // The three AI codes are filtered out before they reach here — the AI block is not
      // built (plan 41, "Отложено"), and a warning about a switch the author cannot see
      // is worse than no warning. Handled to keep the switch total, so that building the
      // block later is a compile error away from being reported.
      case 'AI_WITHOUT_CHECK':
        return t('errorCorrection.issues.AI_WITHOUT_CHECK');
      case 'AI_UNLIMITED_BEFORE_SUBMIT':
        return t('errorCorrection.issues.AI_UNLIMITED_BEFORE_SUBMIT');
      case 'REFS_AFTER_SUBMIT_WITH_RETRIES':
        return t('errorCorrection.issues.REFS_AFTER_SUBMIT_WITH_RETRIES');
    }
  };
}

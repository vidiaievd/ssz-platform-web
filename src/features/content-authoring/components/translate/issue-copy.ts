'use client';

import { useTranslations } from 'next-intl';

import type { Issue } from '@/lib/shared-kernel/translate';

/**
 * Turns a validation code into a sentence in the teacher's language.
 *
 * The kernel carries codes and parameters and no prose: the same document is judged on
 * the server, where there is no locale, and the builder is translated into four languages.
 * This is the renderer on that side of the line — the same contract as
 * `error-correction/issue-copy.ts`.
 */
export function useIssueCopy(): (issue: Issue) => string {
  const t = useTranslations('Authoring');

  return (issue: Issue): string => {
    switch (issue.code) {
      case 'EX_NO_INSTRUCTION':
        return t('translate.issues.EX_NO_INSTRUCTION');
      case 'BOTH_ONE_DIRECTION':
        return t('translate.issues.BOTH_ONE_DIRECTION');
      case 'EX_NO_ITEMS':
        return t('translate.issues.EX_NO_ITEMS');
      case 'SINGLE_MANY_ITEMS':
        return t('translate.issues.SINGLE_MANY_ITEMS', { count: issue.itemCount });
      case 'ITEM_NO_REF':
        return t('translate.issues.ITEM_NO_REF', { index: issue.itemIndex + 1 });
      case 'ITEM_TOO_LONG':
        return t('translate.issues.ITEM_TOO_LONG', {
          index: issue.itemIndex + 1,
          count: issue.wordCount,
        });
      case 'REF_BROKEN_ALTERNATIVES':
        return t('translate.issues.REF_BROKEN_ALTERNATIVES', {
          index: issue.itemIndex + 1,
          ref: issue.ref,
        });
      case 'REF_TOO_MANY_VARIANTS':
        return t('translate.issues.REF_TOO_MANY_VARIANTS', {
          index: issue.itemIndex + 1,
          count: issue.variantCount,
        });
      case 'FORBID_IN_REF':
        return t('translate.issues.FORBID_IN_REF', {
          index: issue.itemIndex + 1,
          guard: issue.guard,
        });
      case 'REQUIRE_NOT_IN_REF':
        return t('translate.issues.REQUIRE_NOT_IN_REF', {
          index: issue.itemIndex + 1,
          guard: issue.guard,
        });
      case 'NO_ALT_VARIANTS':
        return t('translate.issues.NO_ALT_VARIANTS');
      case 'CHECK_FOLD_DIACRITICS':
        return t('translate.issues.CHECK_FOLD_DIACRITICS');
      case 'CHECK_NEAR_TOO_LOW':
        return t('translate.issues.CHECK_NEAR_TOO_LOW', {
          percent: Math.round(issue.near * 100),
        });
      // Step 4's codes are filtered out before they reach here while its controls are
      // unbuilt (see `builder.tsx`). Handled anyway, so that building the step is a
      // compile error away from reporting them.
      case 'AI_WITHOUT_CHECK':
        return t('translate.issues.AI_WITHOUT_CHECK');
      case 'AI_UNLIMITED_BEFORE_SUBMIT':
        return t('translate.issues.AI_UNLIMITED_BEFORE_SUBMIT');
      case 'REFS_AFTER_SUBMIT':
        return t('translate.issues.REFS_AFTER_SUBMIT');
    }
  };
}

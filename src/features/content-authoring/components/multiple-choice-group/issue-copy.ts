'use client';

import { useTranslations } from 'next-intl';

import type { Issue, MultipleChoiceGroupContent } from '@/lib/shared-kernel/multiple-choice-group';

export interface IssueCopyOptions {
  /**
   * Leave the subject off.
   *
   * For a message rendered under the very statement it is about, where "Statement 3"
   * repeats what the row already says. The gate has no such context and always names it.
   */
  bare?: boolean;
}

/**
 * Turns a validation code into a sentence in the teacher's language.
 *
 * The kernel carries codes and parameters and no prose: the same document is judged by the
 * server's publish preflight, where there is no locale, and the builder is translated into
 * four languages (deviation 2 of plan 54 §5). This is the renderer on that side of the
 * line — the same contract as the eight builders before it.
 *
 * The document is a parameter because most codes name their subject by id, and an id is
 * not something a teacher can find on screen. Resolving it here turns it into the position
 * they are looking at — "Statement 3", "Column «Galt»". A subject that has since been
 * deleted falls back to the bare sentence rather than printing a stale index, which is what
 * makes it safe to hold an issue list across an edit.
 */
export function useIssueCopy(
  exercise: MultipleChoiceGroupContent,
): (issue: Issue, options?: IssueCopyOptions) => string {
  const t = useTranslations('Authoring');

  const subjectOf = (issue: Issue): string | null => {
    if ('rowId' in issue) {
      const index = exercise.rows.findIndex((r) => r.id === issue.rowId);
      return index === -1 ? null : t('multipleChoiceGroup.subject.statement', { index: index + 1 });
    }
    if ('columnId' in issue) {
      const at = exercise.columns.findIndex((c) => c.id === issue.columnId);
      if (at === -1) return null;
      const label = exercise.columns[at]?.label.trim() ?? '';
      return label === ''
        ? t('multipleChoiceGroup.subject.columnAt', { index: at + 1 })
        : t('multipleChoiceGroup.subject.column', { label });
    }
    return null;
  };

  return (issue, options = {}): string => {
    const message = t(
      `multipleChoiceGroup.issues.${issue.code}` as 'multipleChoiceGroup.issues.EX_NO_ROWS',
      // Passed for every code rather than branched on: an unused parameter costs nothing,
      // and a switch here would be a second list of codes to keep in step with the kernel.
      {
        count: 'count' in issue ? issue.count : 0,
        length: 'length' in issue ? issue.length : 0,
        share: 'share' in issue ? Math.round(issue.share * 100) : 0,
        threshold: 'threshold' in issue ? issue.threshold : 0,
      },
    );
    if (options.bare === true) return message;

    const subject = subjectOf(issue);
    return subject === null ? message : t('multipleChoiceGroup.subject.join', { subject, message });
  };
}

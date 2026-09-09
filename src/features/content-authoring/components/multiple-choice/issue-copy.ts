'use client';

import { useTranslations } from 'next-intl';

import type { Issue, MultipleChoiceContent } from '@/lib/shared-kernel/multiple-choice';

/** The badges the builder and the runner both letter options with. */
const LETTERS = 'ABCDEFGH';

export interface IssueCopyOptions {
  /**
   * Leave the subject off.
   *
   * For a message rendered under the very option it is about, where "Question 2 · B"
   * repeats what the card already says. The gate has no such context and always names it.
   */
  bare?: boolean;
}

/**
 * Turns a validation code into a sentence in the teacher's language.
 *
 * The kernel carries codes and parameters and no prose: the same document is judged by
 * the server's publish preflight, where there is no locale, and the builder is translated
 * into four languages (plan 53 §3.6). This is the renderer on that side of the line — the
 * same contract as the seven builders before it.
 *
 * The document is a parameter because most codes name their subject by id, and an id is
 * not something a teacher can find on screen. Resolving it here turns it into the position
 * they are looking at: "Question 2", "Question 2 · B". A subject that has since been
 * deleted falls back to the bare sentence rather than printing a stale index — which is
 * what makes it safe to hold an issue list across an edit.
 */
export function useIssueCopy(
  exercise: MultipleChoiceContent,
): (issue: Issue, options?: IssueCopyOptions) => string {
  const t = useTranslations('Authoring');

  const subjectOf = (issue: Issue): string | null => {
    if (!('questionId' in issue)) return null;
    const index = exercise.questions.findIndex((q) => q.id === issue.questionId);
    if (index === -1) return null;

    if (!('optionId' in issue)) return t('multipleChoice.subject.question', { index: index + 1 });

    const options = exercise.questions[index]?.options ?? [];
    const at = options.findIndex((o) => o.id === issue.optionId);
    if (at === -1) return t('multipleChoice.subject.question', { index: index + 1 });
    return t('multipleChoice.subject.option', {
      index: index + 1,
      letter: LETTERS[at] ?? String(at + 1),
    });
  };

  return (issue, options = {}): string => {
    const message = t(
      `multipleChoice.issues.${issue.code}` as 'multipleChoice.issues.Q_NO_STEM',
      // Only `Q_TOO_FEW_OPTIONS` has a parameter of its own. Passed for every code rather
      // than branched on: an unused parameter costs nothing, and a switch here would be a
      // second list of codes to keep in step with the kernel.
      { count: 'count' in issue ? issue.count : 0 },
    );
    if (options.bare === true) return message;

    const subject = subjectOf(issue);
    return subject === null ? message : t('multipleChoice.subject.join', { subject, message });
  };
}

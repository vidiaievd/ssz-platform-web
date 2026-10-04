'use client';

import { useTranslations } from 'next-intl';

import type { HighlightInTextContent, Issue } from '@/lib/shared-kernel/highlight-in-text';

export interface IssueCopyOptions {
  /** The message without the «Question 2 — » prefix, for a line drawn on that very question. */
  bare?: boolean;
}

export interface IssueCopy {
  /** What is wrong, in the teacher's language. */
  describe: (issue: Issue, options?: IssueCopyOptions) => string;
  /** The label of the button that goes and fixes it — the prototype's `fix`. */
  fix: (issue: Issue) => string;
}

/**
 * The words for a kernel issue (plan 67, phase 6).
 *
 * The kernel names what is wrong and where — a code and a question id — and never the
 * sentence, so the rail, the step and the gate all read from one place and say the same thing
 * (AC-X1). A question's number is its place in the list, looked up here in the document as it
 * is now: the kernel does not know it, and deleting a question changes it (deviation 11 —
 * named by question, never counted).
 */
export function useIssueCopy(exercise: HighlightInTextContent): IssueCopy {
  const t = useTranslations('Authoring.highlightInText');

  const subjectOf = (issue: Issue): string | null => {
    if (!('questionId' in issue)) return null;
    const index = exercise.questions.findIndex((q) => q.id === issue.questionId);
    return index === -1 ? null : t('subject.question', { index: index + 1 });
  };

  return {
    describe: (issue, options = {}) => {
      const message = t(`issues.${issue.code}` as 'issues.HT_NO_TEXT', {
        count: 'count' in issue ? issue.count : 0,
        words: 'words' in issue ? issue.words : 0,
        share: 'share' in issue ? Math.round(issue.share * 100) : 0,
      });
      if (options.bare === true) return message;
      const subject = subjectOf(issue);
      return subject === null ? message : t('subject.join', { subject, message });
    },
    fix: (issue) => t(`fixes.${issue.code}` as 'fixes.HT_NO_TEXT'),
  };
}

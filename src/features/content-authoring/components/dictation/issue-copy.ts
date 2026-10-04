'use client';

import { useTranslations } from 'next-intl';

import { formatDuration } from '@/lib/shared-kernel/audio';
import type { DictationContent, Issue } from '@/lib/shared-kernel/dictation';

export interface IssueCopyOptions {
  /** The message without the «Segment 2 — » prefix, for a line drawn on that very segment. */
  bare?: boolean;
}

export interface IssueCopy {
  /** What is wrong, in the teacher's language. */
  describe: (issue: Issue, options?: IssueCopyOptions) => string;
  /** The label of the button that goes and fixes it — the prototype's `fix`. */
  fix: (issue: Issue) => string;
}

/**
 * The words for a kernel issue (plan 68, phase 6).
 *
 * The kernel names what is wrong and where — a code and a segment id — and never the
 * sentence, so the rail, the step and the gate all read from one place and say the same thing
 * (AC-X1). A segment's number is its place in the list, looked up here in the document as it
 * is now: the kernel does not know it, and deleting a segment changes it (deviation 11 —
 * named by segment, never counted).
 */
export function useIssueCopy(exercise: DictationContent): IssueCopy {
  const t = useTranslations('Authoring.dictation');

  const subjectOf = (issue: Issue): string | null => {
    if (!('segmentId' in issue)) return null;
    const index = exercise.segments.findIndex((s) => s.id === issue.segmentId);
    return index === -1 ? null : t('subject.segment', { index: index + 1 });
  };

  return {
    describe: (issue, options = {}) => {
      const message = t(`issues.${issue.code}` as 'issues.DICT_NO_TITLE', {
        words: 'words' in issue ? issue.words : 0,
        count: 'count' in issue ? issue.count : 0,
        time: 'seconds' in issue ? formatDuration(issue.seconds) : '',
      });
      if (options.bare === true) return message;
      const subject = subjectOf(issue);
      return subject === null ? message : t('subject.join', { subject, message });
    },
    fix: (issue) => t(`fixes.${issue.code}` as 'fixes.DICT_NO_TITLE'),
  };
}

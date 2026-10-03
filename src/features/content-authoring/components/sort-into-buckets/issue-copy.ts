'use client';

import { useTranslations } from 'next-intl';

import type { Issue, SortIntoBucketsContent } from '@/lib/shared-kernel/sort-into-buckets';
import { buckets } from '@/lib/shared-kernel/sort-into-buckets';

export interface IssueCopyOptions {
  /** The message without the «Item 3 — » prefix, for a line drawn under that very row. */
  bare?: boolean;
}

/**
 * The words for a kernel issue, in the teacher's language.
 *
 * The kernel names what is wrong and where — a code and a bucket or item id — and never the
 * sentence, so the rail, the inline callouts and the gate all read from one place and say
 * the same thing (AC-X1). The subject is looked up here, by id, in the document as it is
 * now: an item's number is its place in the list, which the kernel does not know and a
 * reorder changes.
 */
export function useIssueCopy(
  exercise: SortIntoBucketsContent,
): (issue: Issue, options?: IssueCopyOptions) => string {
  const t = useTranslations('Authoring.sortIntoBuckets');

  const subjectOf = (issue: Issue): string | null => {
    if ('itemId' in issue) {
      const index = exercise.items.findIndex((item) => item.id === issue.itemId);
      return index === -1 ? null : t('subject.item', { index: index + 1 });
    }
    if ('bucketId' in issue) {
      const shown = buckets(exercise);
      const at = shown.findIndex((b) => b.id === issue.bucketId);
      if (at === -1) return null;
      const label = shown[at]?.label.trim() ?? '';
      return label === ''
        ? t('subject.bucketAt', { index: at + 1 })
        : t('subject.bucket', { label });
    }
    return null;
  };

  return (issue, options = {}): string => {
    const message = t(`issues.${issue.code}` as 'issues.SB_BUCKETS_TOO_FEW', {
      count: 'count' in issue ? issue.count : 0,
      total: 'total' in issue ? issue.total : 0,
      words: 'words' in issue ? issue.words : 0,
      share: 'share' in issue ? Math.round(issue.share * 100) : 0,
    });
    if (options.bare === true) return message;

    const subject = subjectOf(issue);
    return subject === null ? message : t('subject.join', { subject, message });
  };
}

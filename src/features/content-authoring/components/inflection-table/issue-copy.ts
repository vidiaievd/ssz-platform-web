'use client';

import { useTranslations } from 'next-intl';

import {
  packOf,
  slotsInPlay,
  type InflectionTableContent,
  type Issue,
} from '@/lib/shared-kernel/inflection-table';

export interface IssueCopyOptions {
  /** The message without the «Row 2 — » prefix, for a line drawn on that very row. */
  bare?: boolean;
}

export interface IssueCopy {
  /** What is wrong, in the teacher's language. */
  describe: (issue: Issue, options?: IssueCopyOptions) => string;
  /** The label of the button that goes and fixes it — the prototype's `fix`. */
  fix: (issue: Issue) => string;
}

/**
 * The words for a kernel issue (plan 69, phase 6).
 *
 * The kernel names what is wrong and where — a code, a row id, a slot id — and never the
 * sentence, so the rail, the steps and the gate all read from one place and say the same thing
 * (IT-B1). A row is called by its lemma and a cell by its lemma and its column («ei bok ·
 * Bestemt entall»), looked up in the document as it is now: the issue does not carry them, and
 * deleting a row changes every number (deviation 11 — named, never counted).
 */
export function useIssueCopy(exercise: InflectionTableContent): IssueCopy {
  const t = useTranslations('Authoring.inflectionTable');

  const slotLabel = (slotId: string): string =>
    slotsInPlay(exercise).find((s) => s.id === slotId)?.label ??
    packOf(exercise)
      ?.paradigms.flatMap((p) => p.slots)
      .find((s) => s.id === slotId)?.label ??
    slotId;

  const rowName = (rowId: string): string => {
    const index = exercise.rows.findIndex((r) => r.id === rowId);
    if (index === -1) return '';
    const lemma = exercise.rows[index]?.lemma.trim() ?? '';
    return lemma === '' ? t('subject.row', { index: index + 1 }) : lemma;
  };

  const subjectOf = (issue: Issue): string | null => {
    if ('rowId' in issue && 'slotId' in issue) {
      const row = rowName(issue.rowId);
      return row === '' ? null : t('subject.cell', { row, slot: slotLabel(issue.slotId) });
    }
    if ('rowId' in issue) {
      const row = rowName(issue.rowId);
      return row === '' ? null : row;
    }
    return null;
  };

  return {
    describe: (issue, options = {}) => {
      const message = t(`issues.${issue.code}` as 'issues.IT_NO_ROWS', {
        count: 'count' in issue ? issue.count : 0,
        missing: 'missing' in issue ? issue.missing : 0,
        slot: 'slotId' in issue && !('rowId' in issue) ? slotLabel(issue.slotId) : '',
        language: 'language' in issue ? issue.language : '',
      });
      if (options.bare === true) return message;
      const subject = subjectOf(issue);
      return subject === null ? message : t('subject.join', { subject, message });
    },
    fix: (issue) => t(`fixes.${issue.code}` as 'fixes.IT_NO_ROWS'),
  };
}

'use client';

import { useTranslations } from 'next-intl';

import {
  contrastsOf,
  formatMs,
  type Issue,
  type MinimalPairsContent,
} from '@/lib/shared-kernel/minimal-pairs';

export interface IssueCopy {
  /** What is wrong, in the teacher's language. */
  describe: (issue: Issue) => string;
  /** The label of the button that goes and fixes it — the prototype's `fix`. */
  fix: (issue: Issue) => string;
  /** «Pair 2» — a pair by its place in the list as it stands now. */
  pairName: (pairId: string) => string;
}

/**
 * The words for a kernel issue (plan 72 §4.3).
 *
 * The kernel names what is wrong and where — a code, a pair or word id, the numbers — and never
 * the sentence, so the rail, the steps and the gate say the same thing. A pair is called by its
 * place in the list («Pair 2»), looked up in the document as it is now: deleting a pair
 * renumbers the others, so the number is never stored. A family is called by its pack label
 * («kj / sj»), as the student sees it.
 */
export function useIssueCopy(exercise: MinimalPairsContent): IssueCopy {
  const t = useTranslations('Authoring.minimalPairs');
  const families = contrastsOf(exercise.language);

  const pairName = (pairId: string): string => {
    const index = exercise.pairs.findIndex((p) => p.id === pairId);
    return t('subject.pair', { index: index + 1 });
  };
  const label = (contrastId: string): string =>
    families.find((c) => c.id === contrastId)?.label ?? contrastId;

  return {
    pairName,
    describe: (issue) =>
      t(`issues.${issue.code}` as 'issues.MP_NO_PAIRS', {
        subject: 'pairId' in issue ? pairName(issue.pairId) : '',
        language: 'language' in issue ? issue.language : '',
        words: 'words' in issue ? issue.words : 0,
        ready: 'ready' in issue ? issue.ready : 0,
        text: 'text' in issue ? issue.text : '',
        voices: 'voices' in issue ? issue.voices.join(' / ') : '',
        count: 'count' in issue ? issue.count : 0,
        label: 'contrastId' in issue ? label(issue.contrastId) : '',
        length: 'durationMs' in issue ? formatMs(issue.durationMs) : '',
        ms: 'spreadMs' in issue ? issue.spreadMs : 0,
        probes: 'probes' in issue ? issue.probes : 0,
        pool: 'pool' in issue ? issue.pool : 0,
        min: 'min' in issue ? issue.min : 0,
        max: 'max' in issue ? issue.max : 0,
        options: 'options' in issue ? issue.options : 0,
        passPct: 'passPct' in issue ? issue.passPct : 0,
      }),
    fix: (issue) => t(`fixes.${issue.code}` as 'fixes.MP_NO_PAIRS'),
  };
}

'use client';

import { useTranslations } from 'next-intl';

import { formatSeconds, type Issue, type ReadAloudContent } from '@/lib/shared-kernel/read-aloud';

export interface IssueCopy {
  /** What is wrong, in the teacher's language. */
  describe: (issue: Issue) => string;
  /** The label of the button that goes and fixes it — the prototype's `fix`. */
  fix: (issue: Issue) => string;
}

/**
 * The words for a kernel issue (plan 70 §4.3).
 *
 * The kernel names what is wrong and where — a code and a prompt or criterion id — and never
 * the sentence, so the rail, the steps and the gate say the same thing (RA-B15). A prompt is
 * called by its label, as the author wrote it («Avsnitt 1»), and by its place in the list when
 * it has none; a criterion by its name, looked up in the document as it is now. Deleting a
 * prompt renumbers the others, so the number is never stored.
 */
export function useIssueCopy(exercise: ReadAloudContent): IssueCopy {
  const t = useTranslations('Authoring.readAloud');

  const promptName = (promptId: string): string => {
    const index = exercise.prompts.findIndex((p) => p.id === promptId);
    if (index === -1) return t('subject.prompt', { index: 0 });
    const label = exercise.prompts[index]?.label.trim() ?? '';
    return label === '' ? t('subject.prompt', { index: index + 1 }) : label;
  };

  const criterionName = (criterionId: string): { index: number; name: string } => {
    const index = exercise.rubric.findIndex((c) => c.id === criterionId);
    return { index: index + 1, name: exercise.rubric[index]?.name.trim() ?? '' };
  };

  return {
    describe: (issue) => {
      const subject = 'promptId' in issue ? promptName(issue.promptId) : '';
      const criterion =
        'criterionId' in issue ? criterionName(issue.criterionId) : { index: 0, name: '' };
      return t(`issues.${issue.code}` as 'issues.RA_NO_PROMPTS', {
        subject,
        index: criterion.index,
        name: criterion.name === '' ? '—' : criterion.name,
        what: 'need' in issue ? t(`need.${issue.need}` as 'need.text') : '',
        words: 'words' in issue ? issue.words : 0,
        points: 'points' in issue ? issue.points : 0,
        count: 'count' in issue ? issue.count : 0,
        takes: 'takes' in issue ? issue.takes : 0,
        passScore: 'passScore' in issue ? issue.passScore : 0,
        max: 'max' in issue ? issue.max : 0,
        limit: 'maxSeconds' in issue ? formatSeconds(issue.maxSeconds) : '',
        ceiling: 'ceiling' in issue ? formatSeconds(issue.ceiling) : '',
        read: 'readSeconds' in issue ? formatSeconds(issue.readSeconds) : '',
      });
    },
    fix: (issue) => t(`fixes.${issue.code}` as 'fixes.RA_NO_PROMPTS'),
  };
}

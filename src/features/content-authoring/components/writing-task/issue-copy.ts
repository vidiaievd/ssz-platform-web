'use client';

import { useTranslations } from 'next-intl';

import type { Issue, WritingTaskContent } from '@/lib/shared-kernel/writing-task';

/**
 * Turns a validation code into a sentence in the teacher's language.
 *
 * The kernel deliberately carries codes and parameters and no prose: the same document is
 * judged on the server, where there is no locale, and the builder is translated into four
 * languages (plan 50 §4, last row). This is the renderer that side of the line — the same
 * contract as the four builders before it.
 *
 * Every code is handled, `info` ones included: `AI_STAGE_OFF_DRAFT_ON` never reaches the
 * gate, which lists blockers and warnings only, but a switch that quietly returned nothing
 * for it would go unnoticed the day the step wants to show it inline.
 *
 * The document is a parameter because three codes name their subject by id — a point, a
 * criterion — and an id is not something a teacher can find on screen. Resolving it here
 * turns it into the position they are looking at. A subject that has since been deleted
 * falls back to the unnumbered sentence rather than printing a stale index.
 */
export function useIssueCopy(exercise: WritingTaskContent): (issue: Issue) => string {
  const t = useTranslations('Authoring');

  const pointNo = (id: string): number | null => {
    const index = exercise.points.findIndex((point) => point.id === id);
    return index === -1 ? null : index + 1;
  };
  const criterionNo = (id: string): number | null => {
    const index = exercise.rubric.findIndex((c) => c.id === id);
    return index === -1 ? null : index + 1;
  };

  return (issue: Issue): string => {
    switch (issue.code) {
      case 'EX_NO_PROMPT':
        return t('writingTask.issues.EX_NO_PROMPT');
      case 'MODE_NO_SOURCE':
        return t('writingTask.issues.MODE_NO_SOURCE');
      case 'MODE_NO_RECIPIENT':
        return t('writingTask.issues.MODE_NO_RECIPIENT');
      case 'MODE_NO_IMAGE':
        return t('writingTask.issues.MODE_NO_IMAGE');
      case 'EX_NO_POINTS':
        return t('writingTask.issues.EX_NO_POINTS');
      case 'POINTS_TOO_MANY':
        return t('writingTask.issues.POINTS_TOO_MANY', { count: issue.count });
      case 'POINT_NO_KEYWORDS': {
        const index = pointNo(issue.pointId);
        return index === null
          ? t('writingTask.issues.POINT_NO_KEYWORDS_ANY')
          : t('writingTask.issues.POINT_NO_KEYWORDS', { index });
      }
      case 'EX_NO_MODEL':
        return t('writingTask.issues.EX_NO_MODEL');
      case 'LEN_MAX_LTE_MIN':
        return t('writingTask.issues.LEN_MAX_LTE_MIN');
      case 'TIMER_TOO_SHORT':
        return t('writingTask.issues.TIMER_TOO_SHORT', {
          timer: issue.timer,
          count: issue.minWords,
        });
      case 'CRIT_NO_NAME': {
        const index = criterionNo(issue.criterionId);
        return index === null
          ? t('writingTask.issues.CRIT_NO_NAME_ANY')
          : t('writingTask.issues.CRIT_NO_NAME', { index });
      }
      case 'RUBRIC_EMPTY':
        return t('writingTask.issues.RUBRIC_EMPTY');
      case 'PASS_SCORE_TOO_HIGH':
        return t('writingTask.issues.PASS_SCORE_TOO_HIGH', {
          passScore: issue.passScore,
          max: issue.max,
        });
      case 'CRIT_LEVEL_EMPTY': {
        const index = criterionNo(issue.criterionId);
        return index === null
          ? t('writingTask.issues.CRIT_LEVEL_EMPTY_ANY')
          : t('writingTask.issues.CRIT_LEVEL_EMPTY', { index });
      }
      case 'AI_NO_SELF_LIMIT':
        return t('writingTask.issues.AI_NO_SELF_LIMIT');
      case 'AI_STAGE_OFF_DRAFT_ON':
        return t('writingTask.issues.AI_STAGE_OFF_DRAFT_ON');
    }
  };
}

'use client';

import { useTranslations } from 'next-intl';

import type { Issue, ShortAnswerContent } from '@/lib/shared-kernel/short-answer';

/**
 * Turns a validation code into a sentence in the teacher's language.
 *
 * The kernel deliberately carries codes and parameters and no prose: the same document is
 * judged on the server, where there is no locale, and the builder is translated into four
 * languages (plan 51 §5, "Учительский UI по-английски → четыре локали"). This is the
 * renderer that side of the line — the same contract as the five builders before it.
 *
 * The document is a parameter because every code but two names its subject by id, and an
 * id is not something a teacher can find on screen. Resolving it here turns it into the
 * position they are looking at: "Question 2", "Question 2, point 3". A subject that has
 * since been deleted falls back to the unnumbered sentence rather than printing a stale
 * index — which is what makes it safe to hold an issue list across an edit.
 *
 * Every code is handled, `info` ones included. They never reach the gate, which lists
 * blockers and warnings only, but step 2 renders them under the element they are about,
 * and a switch that quietly returned nothing for one would go unnoticed until then.
 */
export function useIssueCopy(exercise: ShortAnswerContent): (issue: Issue) => string {
  const t = useTranslations('Authoring');

  const questionNo = (id: string): number | null => {
    const found = exercise.questions.findIndex((q) => q.id === id);
    return found === -1 ? null : found + 1;
  };

  const elementNo = (questionId: string, elementId: string): number | null => {
    const found = exercise.questions
      .find((q) => q.id === questionId)
      ?.elements.findIndex((e) => e.id === elementId);
    return found === undefined || found === -1 ? null : found + 1;
  };

  return (issue: Issue): string => {
    switch (issue.code) {
      case 'EX_NO_QUESTIONS':
        return t('shortAnswer.issues.EX_NO_QUESTIONS');

      case 'Q_NO_PROMPT': {
        const index = questionNo(issue.questionId);
        return index === null
          ? t('shortAnswer.issues.Q_NO_PROMPT_ANY')
          : t('shortAnswer.issues.Q_NO_PROMPT', { index });
      }

      case 'Q_NO_MODEL': {
        const index = questionNo(issue.questionId);
        return index === null
          ? t('shortAnswer.issues.Q_NO_MODEL_ANY')
          : t('shortAnswer.issues.Q_NO_MODEL', { index });
      }

      case 'Q_NO_PASSAGE': {
        const index = questionNo(issue.questionId);
        return index === null
          ? t('shortAnswer.issues.Q_NO_PASSAGE_ANY')
          : t('shortAnswer.issues.Q_NO_PASSAGE', { index });
      }

      case 'Q_NO_KEY': {
        const index = questionNo(issue.questionId);
        return index === null
          ? t('shortAnswer.issues.Q_NO_KEY_ANY')
          : t('shortAnswer.issues.Q_NO_KEY', { index });
      }

      case 'Q_MODEL_FAILS_KEY': {
        const index = questionNo(issue.questionId);
        return index === null
          ? t('shortAnswer.issues.Q_MODEL_FAILS_KEY_ANY', {
              covered: issue.covered,
              total: issue.total,
            })
          : t('shortAnswer.issues.Q_MODEL_FAILS_KEY', {
              index,
              covered: issue.covered,
              total: issue.total,
            });
      }

      case 'Q_TOO_MANY_ELEMENTS': {
        const index = questionNo(issue.questionId);
        return index === null
          ? t('shortAnswer.issues.Q_TOO_MANY_ELEMENTS_ANY', { count: issue.count })
          : t('shortAnswer.issues.Q_TOO_MANY_ELEMENTS', { index, count: issue.count });
      }

      case 'Q_NO_WHY': {
        const index = questionNo(issue.questionId);
        return index === null
          ? t('shortAnswer.issues.Q_NO_WHY_ANY')
          : t('shortAnswer.issues.Q_NO_WHY', { index });
      }

      // Both numbers or neither, for the four element-level codes: an element index
      // without its question is a position in a list the teacher cannot identify, which
      // is worse than the unnumbered sentence.
      case 'EL_NO_ANCHOR': {
        const index = questionNo(issue.questionId);
        const element = elementNo(issue.questionId, issue.elementId);
        return index === null || element === null
          ? t('shortAnswer.issues.EL_NO_ANCHOR_ANY')
          : t('shortAnswer.issues.EL_NO_ANCHOR', { index, element });
      }

      case 'EL_ANCHOR_NOT_IN_MODEL': {
        const index = questionNo(issue.questionId);
        const element = elementNo(issue.questionId, issue.elementId);
        return index === null || element === null
          ? t('shortAnswer.issues.EL_ANCHOR_NOT_IN_MODEL_ANY', { anchor: issue.anchor })
          : t('shortAnswer.issues.EL_ANCHOR_NOT_IN_MODEL', {
              index,
              element,
              anchor: issue.anchor,
            });
      }

      case 'EL_ANCHOR_TOO_SHORT': {
        const index = questionNo(issue.questionId);
        const element = elementNo(issue.questionId, issue.elementId);
        return index === null || element === null
          ? t('shortAnswer.issues.EL_ANCHOR_TOO_SHORT_ANY', { anchor: issue.anchor })
          : t('shortAnswer.issues.EL_ANCHOR_TOO_SHORT', { index, element, anchor: issue.anchor });
      }

      case 'EL_ONE_ANCHOR': {
        const index = questionNo(issue.questionId);
        const element = elementNo(issue.questionId, issue.elementId);
        return index === null || element === null
          ? t('shortAnswer.issues.EL_ONE_ANCHOR_ANY')
          : t('shortAnswer.issues.EL_ONE_ANCHOR', { index, element });
      }

      case 'PASS_N_TOO_HIGH':
        return t('shortAnswer.issues.PASS_N_TOO_HIGH', { passN: issue.passN });

      case 'NO_TEACHER_REVIEW':
        return t('shortAnswer.issues.NO_TEACHER_REVIEW');
    }
  };
}

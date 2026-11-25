'use client';

import { useTranslations } from 'next-intl';

import { MAX_LESSON_MINUTES, type LessonTimeProblem } from './operations';

/** The words for a `lessonTimeProblem`, the same in every slot and session form. */
export function useLessonTimeMessage(): (problem: LessonTimeProblem | null) => string | null {
  const t = useTranslations('Scheduling.lessonTime');
  return (problem) => {
    if (problem === 'end-before-start') return t('endBeforeStart');
    if (problem === 'too-long') return t('tooLong', { hours: MAX_LESSON_MINUTES / 60 });
    return null;
  };
}

'use client';

import { useTranslations } from 'next-intl';

import { ProgressBar } from '@/components/ui/progress';
import { LangChip } from '@/features/student/home/components';
import { langHue } from '@/features/student/lib/lang-hue';
import type { StudentCourse } from '@/features/student/types';

export interface ProgressCourseRowProps {
  course: StudentCourse;
  onOpen?: (course: StudentCourse) => void;
}

/** Plain, ungamified progress row: language chip, title, lesson/word count, progress bar, big %. */
export function ProgressCourseRow({ course, onOpen }: ProgressCourseRowProps) {
  const t = useTranslations('Student.homeCards.courseProgressCard');
  const tSource = useTranslations('Student.homeCards.sourceTag');
  const hue = langHue(course.targetLanguage);

  const progressLabel =
    course.totalItems > 0
      ? t('lessonsProgress', { done: course.completedItems, total: course.totalItems })
      : t('wordsLearned', { count: course.completedItems });

  return (
    <button
      type="button"
      onClick={() => onOpen?.(course)}
      className="flex w-full items-center gap-4 rounded-lg border-[1.5px] border-(--ssz-border-default) bg-surface p-4 text-left shadow-(--ssz-shadow-xs) transition-colors duration-base ease-out-ssz hover:border-(--hue-c)"
      style={{ '--hue-c': hue.c } as React.CSSProperties}
    >
      <LangChip langCode={course.targetLanguage} level={course.level ?? ''} size={44} />
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-bold text-(--ssz-text-primary)">{course.title}</div>
        <div className="mt-0.75 mb-2 text-[12.5px] text-(--ssz-text-muted)">
          {progressLabel} · {tSource(course.source)}
        </div>
        <ProgressBar
          value={course.progressPercent}
          color={hue.c}
          height={7}
          label={`${progressLabel} — ${course.progressPercent}%`}
        />
      </div>
      <div
        className="shrink-0 text-[20px] font-extrabold tracking-[-0.02em]"
        style={{ color: hue.deep }}
      >
        {course.progressPercent}%
      </div>
    </button>
  );
}

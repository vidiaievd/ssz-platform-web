'use client';

import { Play } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { ProgressBar } from '@/components/ui/progress';
import { langHue } from '@/features/student/lib/lang-hue';
import { cn } from '@/lib/utils';
import { LangChip } from './lang-chip';
import { SourceTag, type CourseSource } from './source-tag';

export interface CourseProgressCardData {
  id: string;
  langCode: string;
  langName: string;
  level: string;
  title: string;
  source: CourseSource;
  school?: string;
  progressPercent: number;
  /** Lesson-based progress; when 0/0, falls back to `wordsLearned` or a plain "in progress" label. */
  completedItems: number;
  totalItems: number;
  wordsLearned?: number;
  nextUnitLabel: string;
  nextItemTitle: string;
  /** Omitted when the course has never been opened — the line is then dropped entirely. */
  lastActiveLabel?: string;
}

export interface CourseProgressCardProps {
  course: CourseProgressCardData;
  onOpen?: (course: CourseProgressCardData) => void;
  className?: string;
}

/** Started-course card: cover chip, progress bar, "up next" and a Resume action. */
export function CourseProgressCard({ course, onOpen, className }: CourseProgressCardProps) {
  const t = useTranslations('Student.homeCards.courseProgressCard');
  const hue = langHue(course.langCode);

  const progressLabel =
    course.totalItems > 0
      ? t('lessonsProgress', { done: course.completedItems, total: course.totalItems })
      : course.wordsLearned
        ? t('wordsLearned', { count: course.wordsLearned })
        : t('inProgress');

  return (
    <button
      type="button"
      onClick={() => onOpen?.(course)}
      style={{ '--hue-c': hue.c, '--hue-soft': hue.soft, '--hue-deep': hue.deep } as React.CSSProperties}
      className={cn(
        'group flex w-full flex-col gap-3.5 rounded-lg border-[1.5px] border-(--ssz-border-default) bg-surface p-4',
        'text-left shadow-(--ssz-shadow-xs) transition-[border-color,box-shadow,transform] duration-base ease-out-ssz',
        'hover:-translate-y-0.5 hover:border-(--hue-c) hover:shadow-(--ssz-shadow-md)',
        className,
      )}
    >
      <div className="flex items-start gap-3.5">
        <LangChip langCode={course.langCode} level={course.level} />
        <div className="min-w-0 flex-1">
          <div className="mb-0.75 text-[11px] font-bold tracking-[0.04em] text-(--hue-deep) uppercase">
            {course.langName}
          </div>
          <div className="text-[15px] leading-tight font-bold tracking-[-0.01em] text-(--ssz-text-primary)">
            {course.title}
          </div>
          <div className="mt-1.75 flex flex-wrap items-center gap-2">
            <SourceTag source={course.source} />
            {course.school && (
              <span className="truncate text-[11.5px] text-(--ssz-text-muted)">
                {course.school}
              </span>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex justify-between text-[11.5px] text-(--ssz-text-muted)">
          <span>{progressLabel}</span>
          <span className="font-bold text-(--hue-deep)">{course.progressPercent}%</span>
        </div>
        <ProgressBar
          value={course.progressPercent}
          color={hue.c}
          height={7}
          label={`${progressLabel} — ${course.progressPercent}%`}
        />
      </div>

      <div className="flex items-center gap-2.5 pt-0.5">
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-bold tracking-wider text-(--ssz-text-muted) uppercase">
            {t('upNext', { unit: course.nextUnitLabel })}
          </div>
          <div className="mt-0.5 truncate text-[13px] font-semibold text-(--ssz-text-primary)">
            {course.nextItemTitle}
          </div>
        </div>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-md bg-(--hue-soft) px-3.5 py-2',
            'text-[12.5px] font-bold text-(--hue-deep) transition-colors duration-base ease-out-ssz',
            'group-hover:bg-(--hue-c) group-hover:text-white',
          )}
        >
          <Play size={11} aria-hidden="true" />
          {t('resume')}
        </span>
      </div>
      {course.lastActiveLabel && (
        <div className="-mt-1 text-[11px] text-(--ssz-text-muted)">
          {t('lastActive', { when: course.lastActiveLabel })}
        </div>
      )}
    </button>
  );
}

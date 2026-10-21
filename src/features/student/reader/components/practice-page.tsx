'use client';

import { Check, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { UnitContentsItem } from '@/features/learning';
import { ProgressBar } from '@/components/ui/progress';

import { ExerciseSolver } from './exercise-page';

export interface PracticePageProps {
  /** Section title, e.g. "Øvelser". */
  title: string;
  /** Every exercise of the section, in authoring order. */
  items: UnitContentsItem[];
  /** Fired every time a task is checked, so the reader can read progress again. */
  onExerciseChecked?: () => void;
  /**
   * The lesson these tasks were set on, for the runners that offer a way back to it —
   * today `multiple_choice_group`'s «Til teksten». Absent when the unit holds no text.
   */
  sourceHref?: string;
}

/**
 * All exercises of one section on a single page — each task keeps its own
 * Check button and inline feedback, so grading stays per-exercise while the
 * reader stops paging through one question at a time.
 */
export function PracticePage({ title, items, onExerciseChecked, sourceHref }: PracticePageProps) {
  const t = useTranslations('Learning.reader.practice');

  /**
   * What the server records, and nothing checked in this sitting (plan 76, 2.6): a check
   * is not a pass, and counting it locally showed «Done» on a failed task and on work
   * still with a teacher. The reader reads progress again after each check, so the badge
   * follows the verdict within a moment. Work handed in counts towards the set — the
   * learner has done their part — and keeps a badge of its own.
   */
  const done = items.filter((i) => i.status === 'completed' || i.status === 'submitted').length;
  const total = items.length;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-[26px] leading-tight font-extrabold text-foreground">{title}</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">{t('taskCount', { n: total })}</p>
        <div className="mt-3.5 flex items-center gap-3">
          <ProgressBar
            value={total > 0 ? Math.round((done / total) * 100) : 0}
            height={6}
            label={t('setProgress', { done, total })}
            className="flex-1"
          />
          <span className="shrink-0 text-[12px] font-semibold text-secondary-foreground">
            {done}/{total}
          </span>
        </div>
      </header>

      <ol className="flex flex-col gap-5">
        {items.map((item, i) => (
          <li
            key={item.id}
            className="relative list-none rounded-2xl border border-(--ssz-border-default) bg-surface px-5 py-5"
          >
            {item.status === 'completed' && (
              <span className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-(--ssz-feedback-ok-bg) px-2 py-0.5 text-[11.5px] font-semibold text-(--ssz-feedback-ok-fg)">
                <Check size={12} aria-hidden="true" />
                {t('taskDone')}
              </span>
            )}
            {item.status === 'submitted' && (
              <span className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-(--ssz-bg-subtle) px-2 py-0.5 text-[11.5px] font-semibold text-secondary-foreground">
                <Send size={12} aria-hidden="true" />
                {t('taskSubmitted')}
              </span>
            )}
            <ExerciseSolver
              exerciseId={item.contentId}
              index={i + 1}
              stacked
              {...(onExerciseChecked === undefined ? {} : { onChecked: () => onExerciseChecked() })}
              {...(sourceHref === undefined ? {} : { sourceHref })}
              {...(item.title === null ? {} : { title: item.title })}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}

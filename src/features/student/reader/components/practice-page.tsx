'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';

import type { UnitContentsItem } from '@/features/learning';
import { ProgressBar } from '@/components/ui/progress';

import { ExerciseSolver } from './exercise-page';

export interface PracticePageProps {
  /** Section title, e.g. "Øvelser". */
  title: string;
  /** Every exercise of the section, in authoring order. */
  items: UnitContentsItem[];
  /** Fired the first time a task is checked, so the reader can record progress. */
  onExerciseChecked?: (item: UnitContentsItem) => void;
}

/**
 * All exercises of one section on a single page — each task keeps its own
 * Check button and inline feedback, so grading stays per-exercise while the
 * reader stops paging through one question at a time.
 */
export function PracticePage({ title, items, onExerciseChecked }: PracticePageProps) {
  const t = useTranslations('Learning.reader.practice');
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const done = checkedIds.length;
  const total = items.length;

  const handleChecked = useCallback(
    (item: UnitContentsItem) => {
      setCheckedIds((ids) => (ids.includes(item.id) ? ids : [...ids, item.id]));
      onExerciseChecked?.(item);
    },
    [onExerciseChecked],
  );

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
            className="list-none rounded-2xl border border-(--ssz-border-default) bg-surface px-5 py-5"
          >
            <ExerciseSolver
              exerciseId={item.contentId}
              index={i + 1}
              onChecked={() => handleChecked(item)}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}

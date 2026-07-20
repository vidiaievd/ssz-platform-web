'use client';

import { useTranslations } from 'next-intl';

import type { MyCoursesFilter } from '@/features/student/schemas/my-courses-filters';
import { MY_COURSES_FILTERS } from '@/features/student/schemas/my-courses-filters';
import { cn } from '@/lib/utils';

export interface SourceFilterPillsProps {
  active: MyCoursesFilter;
  counts: Record<MyCoursesFilter, number>;
  onChange: (filter: MyCoursesFilter) => void;
}

/** Source filter pills with a live count chip per bucket. */
export function SourceFilterPills({ active, counts, onChange }: SourceFilterPillsProps) {
  const t = useTranslations('Student.myCoursesPage.filters');

  return (
    <div role="tablist" aria-label={t('groupLabel')} className="flex flex-wrap gap-2">
      {MY_COURSES_FILTERS.map((filter) => {
        const isActive = filter === active;
        return (
          <button
            key={filter}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(filter)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border-[1.5px] px-3.5 py-1.75 text-[13px] font-bold',
              'transition-colors duration-base ease-out-ssz',
              isActive
                ? 'border-(--ssz-color-primary-500) bg-[oklch(0.93_0.05_168)] text-(--ssz-color-primary-700)'
                : 'border-(--ssz-border-default) bg-surface text-(--ssz-text-secondary) hover:border-(--ssz-border-strong)',
            )}
          >
            {t(filter)}
            <span
              className={cn(
                'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.25 text-[11px] font-bold',
                isActive
                  ? 'bg-white/70 text-(--ssz-color-primary-700)'
                  : 'bg-(--ssz-bg-subtle) text-(--ssz-text-muted)',
              )}
            >
              {counts[filter]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

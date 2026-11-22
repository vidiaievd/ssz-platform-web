'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export type ActivityTag = 'all' | 'people' | 'content' | 'review';

type ActivityFiltersProps = {
  onFilterChange: (tag: ActivityTag) => void;
};

const FILTERS: ActivityTag[] = ['all', 'people', 'content', 'review'];

export function ActivityFilters({ onFilterChange }: ActivityFiltersProps) {
  const t = useTranslations('School.dashboard.activity');
  const [active, setActive] = useState<ActivityTag>('all');

  function handleSelect(tag: ActivityTag) {
    setActive(tag);
    onFilterChange(tag);
  }

  return (
    <div role="radiogroup" aria-label={t('filtersLabel')} className="flex items-center gap-1.5">
      {FILTERS.map((id) => (
        <button
          key={id}
          role="radio"
          aria-checked={active === id}
          onClick={() => handleSelect(id)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            active === id
              ? 'bg-primary/10 text-primary'
              : 'text-(--ssz-text-muted) hover:bg-accent',
          )}
        >
          {t(`filters.${id}`)}
        </button>
      ))}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

export type ActivityTag = 'all' | 'people' | 'content' | 'review';

type ActivityFiltersProps = {
  onFilterChange: (tag: ActivityTag) => void;
};

const FILTERS: { id: ActivityTag; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'people', label: 'People' },
  { id: 'content', label: 'Content' },
  { id: 'review', label: 'Review' },
];

export function ActivityFilters({ onFilterChange }: ActivityFiltersProps) {
  const [active, setActive] = useState<ActivityTag>('all');

  function handleSelect(tag: ActivityTag) {
    setActive(tag);
    onFilterChange(tag);
  }

  return (
    <div role="radiogroup" aria-label="Filter activity" className="flex items-center gap-1.5">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          role="radio"
          aria-checked={active === f.id}
          onClick={() => handleSelect(f.id)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            active === f.id
              ? 'bg-primary/10 text-primary'
              : 'text-(--ssz-text-muted) hover:bg-accent',
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

'use client';

import { useTranslations } from 'next-intl';

import { useUrlFilters } from '@/lib/url-filters/use-url-filters';
import { discoverFilterSchema } from '../schemas';
import type { DiscoverFilter } from '../schemas';
import type { SchoolsResponse } from '../types';
import { DiscoverFilters } from './discover-filters';
import { SchoolsGrid } from './schools-grid';

interface DiscoverSurfaceProps {
  initialData?: SchoolsResponse;
  initialQuery?: DiscoverFilter;
}

type SegmentValue = 'all' | 'school' | 'tutor';

const SEGMENTS: { value: SegmentValue; labelKey: 'filterAll' | 'schoolType.school' | 'schoolType.tutor' }[] = [
  { value: 'all', labelKey: 'filterAll' },
  { value: 'school', labelKey: 'schoolType.school' },
  { value: 'tutor', labelKey: 'schoolType.tutor' },
];

export function DiscoverSurface({ initialData }: DiscoverSurfaceProps) {
  const t = useTranslations('Discovery');
  const [filters, setFilters] = useUrlFilters(discoverFilterSchema);

  const activeSegment: SegmentValue = filters.type ?? 'all';

  function selectSegment(value: SegmentValue) {
    setFilters({ type: value === 'all' ? undefined : value });
  }

  return (
    <div className="space-y-6">
      {/* Segment control: All / Schools / Tutors */}
      <div
        role="group"
        aria-label={t('filterType')}
        className="inline-flex items-center gap-1 rounded-xl bg-muted p-1"
      >
        {SEGMENTS.map(({ value, labelKey }) => {
          const active = activeSegment === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => selectSegment(value)}
              aria-pressed={active}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${
                active
                  ? 'bg-background text-(--ssz-text-primary) shadow-sm'
                  : 'text-(--ssz-text-secondary) hover:text-(--ssz-text-primary)'
              }`}
            >
              {t(labelKey)}
            </button>
          );
        })}
      </div>

      <DiscoverFilters />

      <SchoolsGrid filters={filters} initialData={initialData} />
    </div>
  );
}

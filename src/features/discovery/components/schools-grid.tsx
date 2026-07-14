'use client';

import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { DataState } from '@/components/shared/data-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useSchools } from '../api/use-schools';
import type { DiscoverFilter } from '../schemas';
import type { SchoolsResponse } from '../types';
import { SchoolCard } from './school-card';

interface SchoolsGridProps {
  filters?: DiscoverFilter;
  initialData?: SchoolsResponse;
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-72 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export function SchoolsGrid({ filters, initialData }: SchoolsGridProps) {
  const t = useTranslations('Discovery');
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useSchools({
    filters,
    initialData,
  });

  const schools = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.pageInfo.total;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <DataState
      isLoading={isLoading}
      error={error ? { code: 'unknown' } : null}
      isEmpty={!isLoading && schools.length === 0}
      loadingSlot={<GridSkeleton />}
      emptySlot={
        <div className="py-16 text-center">
          <p className="text-muted-foreground text-sm">{t('noResults')}</p>
        </div>
      }
    >
      {total !== undefined && (
        <p
          className="text-sm text-(--ssz-text-secondary)"
          aria-live="polite"
          aria-atomic="true"
        >
          {t('resultCount', { count: total })}
        </p>
      )}

      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {schools.map((school) => (
          <SchoolCard key={school.id} school={school} />
        ))}
      </div>

      <div ref={sentinelRef} className="h-1" />

      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </DataState>
  );
}

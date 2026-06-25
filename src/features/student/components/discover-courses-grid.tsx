'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';

import { DataState } from '@/components/shared/data-state';
import { Skeleton } from '@/components/ui/skeleton';
import { CatalogueFilters } from '@/features/content/components/catalogue-filters';
import { useContainers } from '@/features/content/api/use-containers';
import { containerFiltersSchema } from '@/features/content/schemas';
import { useUrlFilters } from '@/lib/url-filters/use-url-filters';
import type { School } from '@/features/discovery/types';
import { RequestDialog } from '@/features/enrollment/components/request-dialog';
import { DiscoverCourseCard } from './discover-course-card';

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-52 w-full rounded-xl" />
      ))}
    </div>
  );
}

/** Builds a minimal `School` just to drive `RequestDialog` — the catalogue API doesn't expose the school's full profile. */
function toSchoolStub(match: { schoolId: string; schoolName: string }, targetLanguage: string): School {
  return {
    id: match.schoolId,
    name: match.schoolName,
    slug: match.schoolId,
    type: 'school',
    targetLanguages: [targetLanguage],
    levels: [],
    containerCount: 0,
    isFree: false,
  };
}

export function DiscoverCoursesGrid() {
  const t = useTranslations('Content');
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [requestSchool, setRequestSchool] = useState<School | null>(null);
  const [filters] = useUrlFilters(containerFiltersSchema);

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useContainers({
    filters,
    scope: 'public',
  });

  const containers = data?.pages.flatMap((p) => p.items) ?? [];

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
    <div className="space-y-6">
      <CatalogueFilters />

      <DataState
        isLoading={isLoading}
        error={error ? { code: 'unknown' } : null}
        isEmpty={!isLoading && containers.length === 0}
        loadingSlot={<GridSkeleton />}
        emptySlot={
          <div className="py-16 text-center">
            <p className="text-muted-foreground text-sm">{t('noContainers')}</p>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {containers.map((container) => (
            <DiscoverCourseCard
              key={container.id}
              container={container}
              href={`/catalogue/${container.slug ?? container.id}`}
              onAskToBePlaced={(match) => setRequestSchool(toSchoolStub(match, container.targetLanguage))}
            />
          ))}
        </div>

        <div ref={sentinelRef} className="h-1" />

        {isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          </div>
        )}
      </DataState>

      <RequestDialog
        school={requestSchool}
        open={requestSchool !== null}
        onClose={() => setRequestSchool(null)}
      />
    </div>
  );
}

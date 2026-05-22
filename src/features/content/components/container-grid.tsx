'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';

import { DataState } from '@/components/shared/data-state';
import { Skeleton } from '@/components/ui/skeleton';
import type { UseContainersOptions } from '../api/use-containers';
import { useContainers } from '../api/use-containers';
import { ContainerCard } from './container-card';

interface ContainerGridProps extends UseContainersOptions {
  buildHref: (slug: string) => string;
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-44 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function ContainerGrid({ buildHref, ...queryOptions }: ContainerGridProps) {
  const t = useTranslations('Content');
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useContainers(queryOptions);

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
          <ContainerCard
            key={container.id}
            container={container}
            href={buildHref(container.slug)}
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
  );
}

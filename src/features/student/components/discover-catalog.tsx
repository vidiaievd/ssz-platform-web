'use client';

import { useMemo, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Loader2, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useContainers } from '@/features/content/api/use-containers';
import type { AccessTier } from '@/features/content/types';
import { useUrlFilters } from '@/lib/url-filters/use-url-filters';
import { catalogFiltersSchema, parseLevels, type CatalogTab } from '../schemas/catalog-filters';
import { AccessTabs } from './access-tabs';
import { CatalogFilterBar } from './catalog-filter-bar';
import { CourseCatalogCard } from './course-catalog-card';

const GRID_CLASS = 'grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4.5';

/** Buckets an access tier into the access tab it belongs to. */
function tabOf(accessTier: AccessTier): CatalogTab {
  switch (accessTier) {
    case 'public_free':
      return 'free';
    case 'free_within_school':
    case 'assigned_only':
      return 'school';
    case 'public_paid':
    case 'entitlement_required':
    default:
      return 'paid';
  }
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border-[1.5px] border-(--ssz-border-default) bg-surface p-3">
      <div className="catalog-shimmer h-33 rounded-md" />
      <div className="flex flex-col gap-2.25 px-1 pt-3">
        <div className="catalog-shimmer h-4 w-3/4 rounded-sm" />
        <div className="catalog-shimmer h-2.75 w-full rounded-sm" />
        <div className="catalog-shimmer h-2.75 w-4/5 rounded-sm" />
        <div className="catalog-shimmer mt-1.5 h-5.5 w-2/5 rounded-full" />
      </div>
    </div>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  const t = useTranslations('Catalog');
  return (
    <div className="flex flex-col items-center px-6 py-18 text-center">
      <div className="mb-4 flex size-15 items-center justify-center rounded-full bg-subtle">
        <Search size={26} className="text-(--ssz-text-muted)" aria-hidden="true" />
      </div>
      <p className="mb-1.5 text-[17px] font-bold text-(--ssz-text-primary)">{t('emptyTitle')}</p>
      <p className="mb-4 max-w-95 text-sm leading-relaxed text-(--ssz-text-secondary)">{t('emptyBody')}</p>
      <Button variant="outline" onClick={onClear}>
        {t('clearFilters')}
      </Button>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('Catalog');
  return (
    <div className="flex flex-col items-center px-6 py-18 text-center">
      <div className="mb-4 flex size-15 items-center justify-center rounded-full bg-error-50">
        <AlertCircle size={26} className="text-error-500" aria-hidden="true" />
      </div>
      <p className="mb-1.5 text-[17px] font-bold text-(--ssz-text-primary)">{t('errorTitle')}</p>
      <p className="mb-4 max-w-95 text-sm leading-relaxed text-(--ssz-text-secondary)">{t('errorBody')}</p>
      <Button onClick={onRetry}>{t('retry')}</Button>
    </div>
  );
}

/** Catalogue: access tabs (All / Free / By subscription / From my schools) over the public course list. */
export function DiscoverCatalog() {
  const [filters, setFilters] = useUrlFilters(catalogFiltersSchema);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useContainers({ scope: 'public' });

  const allContainers = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  const activeTab: CatalogTab = filters.tab ?? 'all';
  const tabCounts = useMemo(() => {
    const counts = { all: allContainers.length, free: 0, paid: 0, school: 0 } as Record<CatalogTab, number>;
    for (const c of allContainers) counts[tabOf(c.accessTier)]++;
    return counts;
  }, [allContainers]);

  /* Client-side filtering */
  const activeLevels = parseLevels(filters.levels);
  const filtered = useMemo(() => {
    return allContainers.filter((c) => {
      if (activeTab !== 'all' && tabOf(c.accessTier) !== activeTab) return false;
      if (filters.q) {
        const q = filters.q.toLowerCase();
        const hay = `${c.title} ${c.description ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.lang && c.targetLanguage !== filters.lang) return false;
      if (activeLevels.length && !activeLevels.includes(c.difficultyLevel)) return false;
      return true;
    });
  }, [allContainers, activeTab, filters.q, filters.lang, activeLevels]);

  /* Infinite scroll sentinel */
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

  // Clearing filters is deliberately scoped to search/language/level — the
  // access tab is a navigational choice, not a "filter" the user expects reset.
  function clearFilters() {
    setFilters({ q: undefined, lang: undefined, levels: undefined });
  }

  const showSkeleton = isLoading;
  const showError = !isLoading && !!error;
  const showEmpty = !isLoading && !error && filtered.length === 0;
  const showGrid = !isLoading && !error && filtered.length > 0;

  return (
    <>
      {/* shimmer animation (prefers-reduced-motion safe) */}
      <style>{`
        @keyframes catalog-shimmer {
          from { background-position: -400px 0; }
          to   { background-position:  400px 0; }
        }
        .catalog-shimmer {
          background: linear-gradient(
            90deg,
            var(--ssz-bg-muted) 25%,
            var(--ssz-bg-subtle) 50%,
            var(--ssz-bg-muted) 75%
          );
          background-size: 800px 100%;
          animation: catalog-shimmer 1.3s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .catalog-shimmer { animation: none; }
        }
      `}</style>

      <AccessTabs
        active={activeTab}
        counts={tabCounts}
        onChange={(tab) => setFilters({ tab: tab === 'all' ? undefined : tab })}
      />

      <CatalogFilterBar resultCount={showSkeleton ? null : filtered.length} />

      {showSkeleton && (
        <div className={GRID_CLASS}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {showError && <ErrorState onRetry={() => void refetch()} />}

      {showEmpty && <EmptyState onClear={clearFilters} />}

      {showGrid && (
        <>
          <div className={GRID_CLASS}>
            {filtered.map((container) => (
              <CourseCatalogCard
                key={container.id}
                container={container}
                href={`/catalogue/${container.slug ?? container.id}`}
              />
            ))}
          </div>

          <div ref={sentinelRef} className="h-1" />

          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-(--ssz-text-muted)" />
            </div>
          )}
        </>
      )}
    </>
  );
}

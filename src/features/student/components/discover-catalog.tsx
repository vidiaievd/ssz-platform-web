'use client';

import { useMemo, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Search, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useContainers } from '@/features/content/api/use-containers';
import { useUrlFilters } from '@/lib/url-filters/use-url-filters';
import { catalogFiltersSchema, parseLevels } from '../schemas/catalog-filters';
import { CatalogFilterBar } from './catalog-filter-bar';
import { CourseCatalogCard } from './course-catalog-card';

/* ── Skeleton card matches real card proportions ─────────── */
function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--ssz-bg-surface)',
        borderRadius: 16,
        padding: 12,
        border: '1.5px solid var(--ssz-border-default)',
      }}
    >
      <div className="catalog-shimmer" style={{ height: 132, borderRadius: 12 }} />
      <div style={{ padding: '12px 4px 4px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div className="catalog-shimmer" style={{ height: 16, borderRadius: 6, width: '70%' }} />
        <div className="catalog-shimmer" style={{ height: 11, borderRadius: 6, width: '100%' }} />
        <div className="catalog-shimmer" style={{ height: 11, borderRadius: 6, width: '85%' }} />
        <div className="catalog-shimmer" style={{ height: 22, borderRadius: 999, width: '40%', marginTop: 6 }} />
      </div>
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────── */
function EmptyState({ onClear }: { onClear: () => void }) {
  const t = useTranslations('Catalog');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '72px 24px' }}>
      <div
        style={{
          width: 60, height: 60, borderRadius: '50%',
          background: 'var(--ssz-bg-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
        }}
      >
        <Search size={26} color="var(--ssz-text-muted)" aria-hidden="true" />
      </div>
      <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--ssz-text-primary)', marginBottom: 6 }}>
        {t('emptyTitle')}
      </p>
      <p style={{ fontSize: 14, color: 'var(--ssz-text-secondary)', maxWidth: 380, lineHeight: 1.6, marginBottom: 16 }}>
        {t('emptyBody')}
      </p>
      <Button variant="outline" onClick={onClear}>{t('clearFilters')}</Button>
    </div>
  );
}

/* ── Error state ─────────────────────────────────────────── */
function ErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('Catalog');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '72px 24px' }}>
      <div
        style={{
          width: 60, height: 60, borderRadius: '50%',
          background: 'oklch(0.92 0.055 15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
        }}
      >
        <AlertCircle size={26} color="oklch(0.50 0.12 15)" aria-hidden="true" />
      </div>
      <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--ssz-text-primary)', marginBottom: 6 }}>
        {t('errorTitle')}
      </p>
      <p style={{ fontSize: 14, color: 'var(--ssz-text-secondary)', maxWidth: 380, lineHeight: 1.6, marginBottom: 16 }}>
        {t('errorBody')}
      </p>
      <Button onClick={onRetry}>{t('retry')}</Button>
    </div>
  );
}

/* ── Main catalog view ───────────────────────────────────── */
export function DiscoverCatalog() {
  const [filters, setFilters] = useUrlFilters(catalogFiltersSchema);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useContainers({ scope: 'public' });

  const allContainers = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  /* Derive school options from the fetched catalog (unique ownerName values) */
  const schoolOptions = useMemo(() => {
    const names = allContainers
      .map((c) => c.ownerName)
      .filter((n): n is string => Boolean(n));
    return [...new Set(names)].sort();
  }, [allContainers]);

  /* Client-side filtering */
  const activeLevels = parseLevels(filters.levels);
  const filtered = useMemo(() => {
    return allContainers.filter((c) => {
      if (filters.q) {
        const q = filters.q.toLowerCase();
        const hay = `${c.title} ${c.description ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.lang && c.targetLanguage !== filters.lang) return false;
      if (filters.school && c.ownerName !== filters.school) return false;
      if (activeLevels.length && !activeLevels.includes(c.difficultyLevel)) return false;
      if (filters.price === 'free' && c.accessTier === 'public_paid') return false;
      if (filters.price === 'paid' && c.accessTier !== 'public_paid') return false;
      return true;
    });
  }, [allContainers, filters.q, filters.lang, filters.school, activeLevels, filters.price]);

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

  function clearFilters() {
    setFilters({ q: undefined, lang: undefined, school: undefined, levels: undefined, price: undefined });
  }

  const showSkeleton = isLoading;
  const showError    = !isLoading && !!error;
  const showEmpty    = !isLoading && !error && filtered.length === 0;
  const showGrid     = !isLoading && !error && filtered.length > 0;

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

      <CatalogFilterBar
        resultCount={showSkeleton ? null : filtered.length}
        schoolOptions={schoolOptions}
      />

      {showSkeleton && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 18 }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {showError && <ErrorState onRetry={() => void refetch()} />}

      {showEmpty && <EmptyState onClear={clearFilters} />}

      {showGrid && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 18 }}>
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

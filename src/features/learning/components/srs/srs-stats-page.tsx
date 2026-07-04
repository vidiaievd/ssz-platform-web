'use client';

import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Link } from '@/lib/i18n/navigation';
import { useSrsStats } from '../../api/use-srs-stats';
import { Heatmap } from './heatmap';

/* ── Stat card ─────────────────────────────────────────────────────── */
interface StatCardProps {
  label: string;
  children: React.ReactNode;
}

function StatCard({ label, children }: StatCardProps) {
  return (
    <div className="rounded-[var(--ssz-radius-lg)] border border-[var(--ssz-border-default)] bg-[var(--ssz-bg-surface)] p-5 shadow-[var(--ssz-shadow-sm)]">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--ssz-text-muted)]">
        {label}
      </p>
      {children}
    </div>
  );
}

/* ── Main stats page ─────────────────────────────────────────────── */
export function SrsStatsPage() {
  const t = useTranslations('Srs');
  const { data, isLoading, isError, refetch } = useSrsStats();

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/student/srs" aria-label="Back to review">
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <h1 className="text-xl font-bold text-[var(--ssz-text-primary)]">
            {t('stats.title')}
          </h1>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-[var(--ssz-radius-lg)]" />
            <Skeleton className="h-28 w-full rounded-[var(--ssz-radius-lg)]" />
            <Skeleton className="h-40 w-full rounded-[var(--ssz-radius-lg)]" />
          </div>
        )}

        {/* Error */}
        {isError && (
          <Alert
            variant="error"
            icon={<AlertTriangle className="h-4 w-4" />}
            title={t('error.title')}
          >
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => void refetch()}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              {t('error.retry')}
            </Button>
          </Alert>
        )}

        {/* Empty state */}
        {!isLoading && !isError && data && data.heatmap.length === 0 && (
          <p className="text-center text-[var(--ssz-text-secondary)] py-12">
            {t('stats.empty')}
          </p>
        )}

        {/* Content */}
        {!isLoading && !isError && data && data.heatmap.length > 0 && (
          <>
            {/* Retention */}
            <StatCard label={t('stats.retention')}>
              <p className="text-4xl font-bold text-[var(--ssz-color-primary-700)]">
                {Math.round(data.retentionRate * 100)}%
              </p>
            </StatCard>

            {/* Mature vs Young */}
            <StatCard label={t('stats.matureYoung')}>
              <div className="flex items-end gap-6">
                <div>
                  <p className="text-3xl font-bold text-[var(--ssz-text-primary)]">
                    {data.matureCount}
                  </p>
                  <p className="text-xs text-[var(--ssz-text-muted)]">{t('stats.mature')}</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-[var(--ssz-text-primary)]">
                    {data.youngCount}
                  </p>
                  <p className="text-xs text-[var(--ssz-text-muted)]">{t('stats.young')}</p>
                </div>
              </div>
            </StatCard>

            {/* Heatmap */}
            <StatCard label={t('stats.last30')}>
              <Heatmap days={data.heatmap} />
            </StatCard>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

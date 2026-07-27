'use client';

import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Link } from '@/lib/i18n/navigation';
import { useSrsStats } from '../../api/use-srs-stats';

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

/** Card counts by FSRS state, in lifecycle order. */
const STATE_ROWS = [
  { key: 'newCount', labelKey: 'stats.stateNew' },
  { key: 'learningCount', labelKey: 'stats.stateLearning' },
  { key: 'reviewCount', labelKey: 'stats.stateReview' },
  { key: 'relearningCount', labelKey: 'stats.stateRelearning' },
  { key: 'suspendedCount', labelKey: 'stats.stateSuspended' },
] as const;

/* ── Main stats page ─────────────────────────────────────────────── */
export function SrsStatsPage() {
  const t = useTranslations('Srs');
  const { data, isLoading, isError, refetch } = useSrsStats();

  const totalCards = data
    ? STATE_ROWS.reduce((sum, row) => sum + data[row.key], 0)
    : 0;

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
        {!isLoading && !isError && data && totalCards === 0 && (
          <p className="text-center text-[var(--ssz-text-secondary)] py-12">
            {t('stats.empty')}
          </p>
        )}

        {/* Content — the server keeps no review log, so retention over time and
            a review heatmap cannot be computed; these are the counts it does
            maintain (SrsStatsDto). */}
        {!isLoading && !isError && data && totalCards > 0 && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <StatCard label={t('stats.dueNow')}>
                <p className="text-4xl font-bold text-[var(--ssz-color-primary-700)]">
                  {data.dueNowCount}
                </p>
              </StatCard>

              <StatCard label={t('stats.reviewedToday')}>
                <p className="text-4xl font-bold text-[var(--ssz-text-primary)]">
                  {data.reviewedTodayCount}
                </p>
              </StatCard>
            </div>

            <StatCard label={t('stats.byState')}>
              <dl className="space-y-2">
                {STATE_ROWS.map(({ key, labelKey }) => (
                  <div key={key} className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm text-[var(--ssz-text-secondary)]">
                      {t(labelKey)}
                    </dt>
                    <dd className="text-lg font-semibold text-[var(--ssz-text-primary)]">
                      {data[key]}
                    </dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-4 border-t border-[var(--ssz-border-default)] pt-2">
                  <dt className="text-sm font-semibold text-[var(--ssz-text-primary)]">
                    {t('stats.total')}
                  </dt>
                  <dd className="text-lg font-bold text-[var(--ssz-text-primary)]">
                    {totalCards}
                  </dd>
                </div>
              </dl>
            </StatCard>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

import { CheckCircle, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';

/* ── Breakdown bar ───────────────────────────────────────────────── */

interface BreakdownItem {
  label: string;
  count: number;
  color: string;
}

function BreakdownBar({ items }: { items: BreakdownItem[] }) {
  const total = items.reduce((s, i) => s + i.count, 0);
  if (total === 0) return null;

  return (
    <div className="mt-3">
      {/* Stacked bar */}
      <div
        className="flex overflow-hidden rounded-full"
        style={{ height: 6 }}
        role="img"
        aria-label="Review breakdown"
      >
        {items.map((item) => (
          <div
            key={item.label}
            style={{
              flex: item.count,
              background: item.color,
            }}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {items.map((item) => (
          <span
            key={item.label}
            className="flex items-center gap-1 text-xs"
            style={{ color: 'var(--ssz-text-muted)' }}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: item.color }}
              aria-hidden="true"
            />
            {item.label} ({item.count})
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── ReviewCard ──────────────────────────────────────────────────── */

export interface ReviewCardProps {
  dueCount: number;
  reviewedToday: number;
  vocabDue: number;
  exerciseDue: number;
  reviewHref: string;
}

export function ReviewCard({
  dueCount,
  reviewedToday,
  vocabDue,
  exerciseDue,
  reviewHref,
}: ReviewCardProps) {
  const t = useTranslations('Learning.courseHome.reviewCard');

  const isEmpty = dueCount === 0;

  const breakdownItems: BreakdownItem[] = [
    {
      label: t('vocab'),
      count: vocabDue,
      color: 'var(--ssz-color-primary-500)',
    },
    {
      label: t('exercises'),
      count: exerciseDue,
      color: 'var(--ssz-color-info-500)',
    },
  ].filter((i) => i.count > 0);

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'var(--ssz-bg-surface)',
        boxShadow: 'var(--ssz-shadow-sm)',
      }}
    >
      {/* Header row */}
      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'var(--ssz-color-warning-100)' }}
          aria-hidden="true"
        >
          <RotateCcw size={18} style={{ color: 'var(--ssz-color-warning-700)' }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: 'var(--ssz-text-primary)' }}>
          {t('title')}
        </p>
      </div>

      {isEmpty ? (
        /* ── Empty state ── */
        <div className="flex flex-col items-center py-4 text-center">
          <CheckCircle
            size={32}
            style={{ color: 'var(--ssz-color-success-500)' }}
            aria-hidden="true"
          />
          <p
            className="mt-2 font-semibold"
            style={{ color: 'var(--ssz-text-primary)' }}
          >
            {t('allReviewed')}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--ssz-text-muted)' }}>
            {t('allReviewedSub')}
          </p>
        </div>
      ) : (
        /* ── Due state ── */
        <>
          <div className="flex items-baseline gap-2">
            <span
              className="font-extrabold leading-none"
              style={{ fontSize: 38, color: 'var(--ssz-text-primary)' }}
            >
              {dueCount}
            </span>
            <span className="text-sm" style={{ color: 'var(--ssz-text-muted)' }}>
              {t('itemsDue')}
            </span>
          </div>

          {reviewedToday > 0 && (
            <p className="mt-1 text-xs" style={{ color: 'var(--ssz-text-muted)' }}>
              {t('reviewedToday', { n: reviewedToday })}
            </p>
          )}

          <BreakdownBar items={breakdownItems} />

          <a
            href={reviewHref}
            className="mt-4 flex w-full items-center justify-center rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--ssz-color-primary-500)', textDecoration: 'none' }}
          >
            {t('cta', { n: dueCount })}
          </a>
        </>
      )}
    </div>
  );
}

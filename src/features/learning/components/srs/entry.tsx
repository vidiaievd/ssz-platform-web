'use client';

import { CheckCircle2, BarChart2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';

/* ── Caught-up (0 due) ─────────────────────────────────────────────── */

function CaughtUpState() {
  const t = useTranslations('Srs');

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <CheckCircle2
        className="h-14 w-14 text-[var(--ssz-color-success-500)]"
        aria-hidden
      />
      <div className="space-y-1">
        <h1 className="text-[30px] font-bold text-[var(--ssz-text-primary)]">
          {t('entry.caughtUp.title')}
        </h1>
        <p className="text-[var(--ssz-text-secondary)]">{t('entry.caughtUp.subtitle')}</p>
      </div>
      <div className="flex flex-col gap-2 w-full">
        <Button asChild>
          <Link href="/student/enrolled/vocabulary">{t('entry.caughtUp.studyNew')}</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/student/srs/stats">
            <BarChart2 className="mr-2 h-4 w-4" aria-hidden />
            {t('entry.stats')}
          </Link>
        </Button>
      </div>
    </div>
  );
}

/* ── Due hero ──────────────────────────────────────────────────────── */

interface SrsEntryProps {
  dueCount: number;
  reviewedToday: number;
  dailyLimit: number;
  onStart: () => void;
}

export function SrsEntry({
  dueCount,
  reviewedToday,
  dailyLimit,
  onStart,
}: SrsEntryProps) {
  const t = useTranslations('Srs');

  if (dueCount === 0) {
    return <CaughtUpState />;
  }

  const limitReached = reviewedToday >= dailyLimit;

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="space-y-1">
        <p
          className="text-[clamp(40px,9vw,56px)] font-bold tracking-[var(--ssz-tracking-tight)] text-[var(--ssz-text-primary)]"
          aria-label={t('entry.dueToday', { count: dueCount })}
        >
          {dueCount}
        </p>
        <p className="text-[var(--ssz-text-secondary)]">{t('entry.dueToday', { count: dueCount })}</p>
      </div>

      {limitReached && (
        <p className="rounded-[var(--ssz-radius-lg)] bg-[var(--ssz-bg-subtle)] border border-[var(--ssz-border-default)] px-4 py-2 text-sm text-[var(--ssz-text-secondary)]">
          {t('entry.limitReachedToday')}
        </p>
      )}

      <div className="flex flex-col gap-2 w-full">
        <Button
          onClick={onStart}
          disabled={limitReached}
          autoFocus
          className="w-full"
        >
          {t('entry.start')}
        </Button>
        <Button asChild variant="ghost" className="w-full">
          <Link href="/student/srs/stats">
            <BarChart2 className="mr-2 h-4 w-4" aria-hidden />
            {t('entry.stats')}
          </Link>
        </Button>
      </div>
    </div>
  );
}

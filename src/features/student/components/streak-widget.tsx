'use client';

import { useTranslations } from 'next-intl';
import { Flame } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { useActivityStreak } from '../api/use-activity-streak';

function StatCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      <span className="text-muted-foreground text-center text-xs">{label}</span>
    </div>
  );
}

export function StreakWidget() {
  const t = useTranslations('Student');
  const { data, isLoading } = useActivityStreak();

  if (isLoading) {
    return <Skeleton className="h-32 w-full rounded-xl" />;
  }

  const streak = data ?? { currentStreak: 0, longestStreak: 0, totalActiveDays: 0 };
  const isActive = streak.currentStreak > 0;

  return (
    <section
      aria-labelledby="streak-heading"
      className="rounded-xl border border-border bg-card p-5"
    >
      <div className="mb-4 flex items-center gap-2">
        <Flame
          className={isActive ? 'text-orange-500' : 'text-muted-foreground'}
          aria-hidden="true"
        />
        <h2 id="streak-heading" className="text-lg font-semibold">
          {t('streak.title')}
        </h2>
      </div>

      {isActive ? (
        <div className="flex justify-around">
          <StatCell
            label={t('streak.current')}
            value={t('streak.days', { count: streak.currentStreak })}
          />
          <div className="w-px bg-border" aria-hidden="true" />
          <StatCell
            label={t('streak.longest')}
            value={t('streak.days', { count: streak.longestStreak })}
          />
          <div className="w-px bg-border" aria-hidden="true" />
          <StatCell
            label={t('streak.totalDays')}
            value={streak.totalActiveDays}
          />
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">{t('streak.noActivity')}</p>
      )}
    </section>
  );
}

'use client';

import { useTranslations } from 'next-intl';

import { useSrsDue } from '@/features/learning/api/use-srs-due';

export interface HomeGreetingProps {
  dateLabel: string;
  firstName: string | null;
  /** Whether the student has a class scheduled for today — resolved server-side. */
  hasClassToday: boolean;
}

/**
 * Greeting plus a one-line state of play. The subtitle names only what is
 * actually pending; with nothing due and no class it stays a plain welcome
 * rather than manufacturing urgency.
 */
export function HomeGreeting({ dateLabel, firstName, hasClassToday }: HomeGreetingProps) {
  const t = useTranslations('Student.home.greeting');
  const { data } = useSrsDue();
  const dueCount = data?.dueCount ?? 0;

  const subtitle =
    hasClassToday && dueCount > 0
      ? t('classAndReviews', { count: dueCount })
      : hasClassToday
        ? t('classOnly')
        : dueCount > 0
          ? t('reviewsOnly', { count: dueCount })
          : t('nothingPending');

  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold tracking-[0.08em] text-(--ssz-text-muted) uppercase">
        {dateLabel}
      </p>
      <h1 className="text-[23px] leading-tight font-bold tracking-[-0.02em] text-(--ssz-text-primary) sm:text-[28px]">
        {firstName ? t('titleNamed', { name: firstName }) : t('title')}
      </h1>
      <p className="mt-1.5 text-[14.5px] text-(--ssz-text-secondary)">{subtitle}</p>
    </div>
  );
}

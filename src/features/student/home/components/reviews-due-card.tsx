'use client';

import { Repeat } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Skeleton } from '@/components/ui/skeleton';
import { useSrsDue } from '@/features/learning/api/use-srs-due';
import { useRouter } from '@/lib/i18n/navigation';
import { ReminderCard } from './reminder-card';

/**
 * "Time to review" reminder, driven by the real SRS queue. When nothing is due
 * it says so plainly and offers no action — an empty queue is a finished job,
 * not a prompt to grind.
 */
export function ReviewsDueCard() {
  const t = useTranslations('Student.home.reviews');
  const router = useRouter();
  const { data, isLoading, error } = useSrsDue();

  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-lg" />;
  }

  // A failed queue fetch is not worth an alarm on Home — the Reviews screen
  // owns that error surface. Render the card's neutral state instead.
  const dueCount = error ? 0 : (data?.dueCount ?? 0);

  if (dueCount === 0) {
    return (
      <ReminderCard tone="amber" icon={Repeat} overline={t('overline')}>
        <p className="text-[13px] leading-relaxed text-(--ssz-text-secondary)">{t('empty')}</p>
      </ReminderCard>
    );
  }

  return (
    <ReminderCard
      tone="amber"
      icon={Repeat}
      overline={t('overline')}
      cta={t('cta', { count: dueCount })}
      onCta={() => router.push('/student/srs')}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-[30px] leading-none font-extrabold tracking-[-0.02em] text-(--ssz-text-primary)">
          {dueCount}
        </span>
        <span className="text-[13px] text-(--ssz-text-secondary)">{t('dueNow', { count: dueCount })}</span>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-(--ssz-text-secondary)">{t('hint')}</p>
    </ReminderCard>
  );
}

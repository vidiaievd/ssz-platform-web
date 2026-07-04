import { Flame } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

interface StreakChipProps {
  days: number;
  className?: string;
}

export function StreakChip({ days, className }: StreakChipProps) {
  const t = useTranslations('Srs.streak');
  const hasStreak = days > 0;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[var(--ssz-radius-full)] px-3 py-1 text-sm font-semibold',
        hasStreak
          ? 'bg-[var(--ssz-color-secondary-100)] text-[var(--ssz-color-secondary-700)]'
          : 'bg-[var(--ssz-bg-subtle)] text-[var(--ssz-text-muted)]',
        className,
      )}
    >
      {hasStreak && <Flame className="h-3.5 w-3.5" aria-hidden />}
      {t('days', { count: days })}
    </span>
  );
}

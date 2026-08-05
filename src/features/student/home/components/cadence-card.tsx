'use client';

import { Check, Target } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

const ACCENT = 'oklch(0.62 0.105 168)';
/** -700 shade for text — the raw accent fails 4.5:1 contrast against white. */
const ACCENT_TEXT = 'var(--ssz-color-primary-700)';

export interface DaySession {
  /** Short weekday label, e.g. "Mon". */
  label: string;
  active: boolean;
  isToday?: boolean;
}

export interface CadenceCardProps {
  /** Cards reviewed today — the only activity figure the backend currently records. */
  reviewedToday: number;
  /**
   * 7-day activity dot row. No backend activity log exists yet, so this is
   * always undefined today — the row renders nothing until a caller can
   * supply it, at which point the card lights up with no further changes.
   */
  sessions?: DaySession[];
  className?: string;
}

/** Streak-free replacement for the old gamified widget: advice + today's activity only. */
export function CadenceCard({ reviewedToday, sessions, className }: CadenceCardProps) {
  const t = useTranslations('Student.homeCards.cadenceCard');

  return (
    <div
      className={cn(
        'rounded-lg border-[1.5px] border-(--ssz-border-default) bg-surface p-4.5 shadow-(--ssz-shadow-xs)',
        className,
      )}
    >
      <div className="mb-4 flex items-center gap-2.25">
        <Target size={18} className="text-(--ssz-text-secondary)" aria-hidden="true" />
        <h2 className="text-[15px] font-bold tracking-[-0.01em] text-(--ssz-text-primary)">
          {t('title')}
        </h2>
      </div>

      <p className="text-[12.5px] leading-relaxed text-(--ssz-text-secondary)">{t('advice')}</p>

      <p className="mt-2.5 text-[12.5px] font-semibold text-(--ssz-text-primary)">
        {t('reviewedToday', { count: reviewedToday })}
      </p>

      {sessions && (
        <div className="mt-4 flex gap-1.5">
          {sessions.map((day, i) => (
            <div key={i} className="flex-1 text-center">
              <div
                className={cn(
                  'mb-1.25 flex aspect-square w-full items-center justify-center rounded-sm border-2',
                  day.isToday ? 'border-(--cadence-accent)' : 'border-transparent',
                )}
                style={{
                  '--cadence-accent': ACCENT,
                  background: day.active ? ACCENT : 'var(--ssz-bg-subtle)',
                } as React.CSSProperties}
              >
                {day.active && <Check size={11} className="text-white" aria-hidden="true" />}
              </div>
              <div
                className="text-[10px]"
                style={{
                  fontWeight: day.isToday ? 700 : 500,
                  color: day.isToday ? ACCENT_TEXT : 'var(--ssz-text-muted)',
                }}
              >
                {day.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

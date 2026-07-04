'use client';

import { BookOpen, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

/* ── icon tile ───────────────────────────────────────────────────────────────── */
function NeutralIcon() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 56,
        height: 56,
        borderRadius: 16,
        background: 'var(--ssz-bg-subtle)',
        border: '1.5px solid var(--ssz-border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <BookOpen size={26} style={{ color: 'var(--ssz-text-secondary)' }} strokeWidth={1.5} />
    </div>
  );
}

/* ── public component ────────────────────────────────────────────────────────── */

export interface PlacementSkippedProps {
  /** Navigate to / start Module 1. */
  onGoToModule1: () => void;
  /** Re-enter the test (reset + startTest). */
  onRetakePlacement: () => void;
}

export function PlacementSkipped({ onGoToModule1, onRetakePlacement }: PlacementSkippedProps) {
  const t = useTranslations('Placement.skipped');

  return (
    <div
      className="flex w-full flex-col items-center gap-[20px] text-center"
      style={{ maxWidth: 420 }}
    >
      <NeutralIcon />

      <div>
        <h1
          className="font-bold leading-[1.25]"
          style={{ fontSize: 24, color: 'var(--ssz-text-primary)' }}
        >
          {t('title')}
        </h1>
        <p
          className="mt-2.5 text-[14.5px] leading-[1.65]"
          style={{ color: 'var(--ssz-text-secondary)' }}
        >
          {t('body')}
        </p>
      </div>

      <div className="flex w-full flex-col gap-[10px]">
        <button
          type="button"
          onClick={onGoToModule1}
          className="inline-flex w-full items-center justify-center gap-[6px] rounded-xl px-6 py-[13px] text-[15px] font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ssz-border-focus)]"
          style={{
            background: 'var(--ssz-color-primary-500)',
            boxShadow: 'var(--ssz-shadow-sm)',
          }}
        >
          {t('goToModule1')}
          <ArrowRight size={15} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onRetakePlacement}
          className="py-2 text-[14px] font-medium hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ssz-border-focus)]"
          style={{ color: 'var(--ssz-text-secondary)' }}
        >
          {t('takePlacement')}
        </button>
      </div>
    </div>
  );
}

'use client';

import { XCircle, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';

/* ── icon tile ───────────────────────────────────────────────────────────────── */
function ErrorIcon() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 60,
        height: 60,
        borderRadius: 16,
        background: 'var(--ssz-color-error-50)',
        border: '1.5px solid var(--ssz-color-error-300)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <XCircle size={30} style={{ color: 'var(--ssz-color-error-500)' }} strokeWidth={1.5} />
    </div>
  );
}

/* ── public component ────────────────────────────────────────────────────────── */

export interface PlacementErrorProps {
  /** Retry: re-enter the loading state (re-fetches the current question). */
  onRetry: () => void;
  /** Bail out: move to skipped state. */
  onStartFromBeginning: () => void;
}

export function PlacementError({ onRetry, onStartFromBeginning }: PlacementErrorProps) {
  const t = useTranslations('Placement.error');

  return (
    <div
      role="alert"
      className="flex w-full flex-col items-center gap-[20px] text-center"
      style={{ maxWidth: 420 }}
    >
      <ErrorIcon />

      <div>
        <h1
          className="font-bold leading-[1.25]"
          style={{ fontSize: 23, color: 'var(--ssz-text-primary)' }}
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
          onClick={onRetry}
          className="inline-flex w-full items-center justify-center gap-[7px] rounded-xl px-6 py-[13px] text-[15px] font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ssz-border-focus)]"
          style={{
            background: 'var(--ssz-color-primary-500)',
            boxShadow: 'var(--ssz-shadow-sm)',
          }}
        >
          <RotateCcw size={15} aria-hidden="true" />
          {t('retry')}
        </button>

        <button
          type="button"
          onClick={onStartFromBeginning}
          className="py-2 text-[14px] font-medium hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ssz-border-focus)]"
          style={{ color: 'var(--ssz-text-secondary)' }}
        >
          {t('startFromBeginning')}
        </button>
      </div>
    </div>
  );
}

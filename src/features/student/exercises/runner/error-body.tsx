'use client';

import { XCircle, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface RunnerErrorBodyProps {
  onRetry?: () => void;
  accent: string;
}

/** Error body shown when the exercise item failed to load. */
export function RunnerErrorBody({ onRetry, accent }: RunnerErrorBodyProps) {
  const t = useTranslations('ExerciseRunner');

  return (
    <div
      className="mx-auto flex w-full flex-col items-center px-6 py-[60px] text-center"
      style={{ maxWidth: 420 }}
      role="alert"
    >
      <div
        className="mb-[18px] flex items-center justify-center"
        style={{
          width: 64,
          height: 64,
          borderRadius: 18,
          background: 'var(--ssz-color-error-50)',
          border: '1.5px solid var(--ssz-color-error-300)',
        }}
      >
        <XCircle size={32} style={{ color: 'var(--ssz-color-error-500)' }} aria-hidden="true" />
      </div>

      <h2
        className="mb-2 font-bold"
        style={{ fontSize: 19, color: 'var(--ssz-text-primary)' }}
      >
        {t('error.title')}
      </h2>

      <p
        className="mb-6 text-[14px] leading-[1.55]"
        style={{ color: 'var(--ssz-text-secondary)' }}
      >
        {t('error.body')}
      </p>

      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--ssz-font-ui)',
            fontWeight: 700,
            fontSize: 15,
            padding: '11px 24px',
            borderRadius: 12,
            color: '#fff',
            background: accent,
          }}
        >
          <RefreshCw size={15} aria-hidden="true" />
          {t('error.retry')}
        </button>
      )}
    </div>
  );
}

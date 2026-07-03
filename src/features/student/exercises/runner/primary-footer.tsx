'use client';

import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { RunnerMode } from './types';

interface PrimaryFooterProps {
  mode: RunnerMode;
  canSubmit: boolean;
  accent: string;
  onSubmit: () => void;
}

/** Sticky footer shown during the answering phase — single submit CTA. */
export function PrimaryFooter({ mode, canSubmit, accent, onSubmit }: PrimaryFooterProps) {
  const t = useTranslations('ExerciseRunner');

  return (
    <div
      className="sticky bottom-0 z-20"
      style={{
        background: 'var(--ssz-bg-surface)',
        borderTop: '1px solid var(--ssz-border-default)',
      }}
    >
      <div
        className="mx-auto flex w-full justify-end px-6 py-[14px]"
        style={{ maxWidth: 760 }}
      >
        <button
          disabled={!canSubmit}
          onClick={canSubmit ? onSubmit : undefined}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            border: 'none',
            cursor: canSubmit ? 'pointer' : 'default',
            fontFamily: 'var(--ssz-font-ui)',
            fontWeight: 700,
            fontSize: 15,
            padding: '12px 30px',
            borderRadius: 12,
            color: '#fff',
            background: accent,
            opacity: canSubmit ? 1 : 0.4,
            transition: 'opacity 160ms, background 160ms',
          }}
          aria-disabled={!canSubmit}
        >
          {mode === 'graded' ? t('submitAnswer') : t('check')}
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

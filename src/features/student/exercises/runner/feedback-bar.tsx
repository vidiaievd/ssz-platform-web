'use client';

import { CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { FeedbackDensity, RunnerMode } from './types';

interface FeedbackBarProps {
  mode: RunnerMode;
  ok: boolean | null;
  density: FeedbackDensity;
  correctAnswer?: string | null;
  explanation?: string | null;
  isLast: boolean;
  accent: string;
  onAdvance: () => void;
}

const OK_BG = 'var(--ssz-color-success-50)';
const OK_LINE = 'var(--ssz-color-success-500)';
const OK_FG = 'oklch(0.40 0.12 145)';

const NO_BG = 'var(--ssz-color-error-50)';
const NO_LINE = 'var(--ssz-color-error-500)';
const NO_FG = 'var(--ssz-color-error-700)';

/** Sticky footer shown during the feedback phase — result + advance button. */
export function FeedbackBar({
  mode,
  ok,
  density,
  correctAnswer,
  explanation,
  isLast,
  accent,
  onAdvance,
}: FeedbackBarProps) {
  const t = useTranslations('ExerciseRunner');
  const isGraded = mode === 'graded';

  type Tone = 'ok' | 'no' | 'neutral';
  const tone: Tone = isGraded ? 'neutral' : ok === true ? 'ok' : 'no';

  const cfg = {
    ok: { bg: OK_BG, line: OK_LINE, fg: OK_FG, title: t('feedback.correct') },
    no: { bg: NO_BG, line: NO_LINE, fg: NO_FG, title: t('feedback.incorrect') },
    neutral: {
      bg: 'var(--ssz-bg-subtle)',
      line: 'var(--ssz-color-secondary-600)',
      fg: 'var(--ssz-color-secondary-700)',
      title: t('feedback.submitted'),
    },
  }[tone];

  const advanceBg = isGraded ? 'var(--ssz-color-secondary-600)' : ok ? OK_LINE : accent;

  return (
    <div
      className="sticky bottom-0 left-0 right-0 z-30"
      style={{ background: cfg.bg, borderTop: `3px solid ${cfg.line}` }}
      role="status"
      aria-live="polite"
    >
      <div
        className="mx-auto flex w-full items-start gap-[14px] px-6 py-[14px]"
        style={{ maxWidth: 760 }}
      >
        {/* Icon */}
        <div
          className="mt-[1px] flex flex-shrink-0 items-center justify-center"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: `${cfg.line}22`,
          }}
          aria-hidden="true"
        >
          {tone === 'no' ? (
            <XCircle size={19} style={{ color: cfg.line }} />
          ) : (
            <CheckCircle size={19} style={{ color: cfg.line }} />
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="font-bold" style={{ fontSize: 14.5, color: cfg.fg }}>
            {cfg.title}
          </div>

          {isGraded ? (
            <div className="mt-[2px] text-[12.5px]" style={{ color: 'var(--ssz-text-secondary)' }}>
              {t('feedback.gradedNote')}
            </div>
          ) : (
            <>
              {!ok && correctAnswer && (
                <div className="mt-[2px] text-[13px]" style={{ color: 'var(--ssz-text-secondary)' }}>
                  {t('feedback.answerLabel')}{' '}
                  <strong style={{ color: cfg.fg }}>{correctAnswer}</strong>
                </div>
              )}
              {density === 'rich' && explanation && (
                <div
                  className="mt-[5px] text-[12.5px] leading-[1.5]"
                  style={{ color: 'var(--ssz-text-secondary)' }}
                >
                  {explanation}
                </div>
              )}
            </>
          )}
        </div>

        {/* Advance button */}
        <button
          onClick={onAdvance}
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--ssz-font-ui)',
            fontWeight: 700,
            fontSize: 15,
            padding: '11px 24px',
            borderRadius: 12,
            color: '#fff',
            background: advanceBg,
          }}
        >
          {isLast ? t('finish') : t('continue')}
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

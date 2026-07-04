'use client';

import { useState } from 'react';
import { Check, CheckCircle, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { BottomBar } from '@/features/learning';
import { cn } from '@/lib/utils';

export interface GrammarQuickCheck {
  question: string;
  options: string[];
  /** 0-based index of the correct option. */
  correctIndex: number;
  explanation?: string;
}

export interface GrammarExProps {
  exercise: GrammarQuickCheck;
  onContinue: () => void;
}

const SUCCESS_BG  = 'oklch(0.94 0.05 145)';
const SUCCESS_BDR = 'oklch(0.76 0.11 145)';
const SUCCESS_FG  = 'oklch(0.40 0.12 145)';
const ERROR_BG    = 'oklch(0.96 0.03 15)';
const ERROR_BDR   = 'oklch(0.88 0.07 15)';
const ERROR_FG    = 'oklch(0.44 0.105 15)';

export function GrammarEx({ exercise, onContinue }: GrammarExProps) {
  const t = useTranslations('Learning.grammarSection');

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [revealed, setRevealed]       = useState(false);

  const isCorrect = selectedIdx === exercise.correctIndex;

  function handleCheck() {
    if (selectedIdx === null) return;
    setRevealed(true);
  }

  function optionStyle(i: number): React.CSSProperties {
    const isSel  = i === selectedIdx;
    const isCorr = i === exercise.correctIndex;

    if (revealed) {
      if (isCorr)       return { background: SUCCESS_BG, borderColor: SUCCESS_BDR, color: SUCCESS_FG };
      if (isSel)        return { background: ERROR_BG,   borderColor: ERROR_BDR,   color: ERROR_FG };
      return { background: 'var(--ssz-bg-surface)', borderColor: 'var(--ssz-border-default)', color: 'var(--ssz-text-muted)', opacity: 0.5 };
    }
    if (isSel) {
      return { background: 'oklch(0.62 0.105 168 / 10%)', borderColor: 'var(--ssz-color-primary-500)', color: 'oklch(0.44 0.09 168)' };
    }
    return { background: 'var(--ssz-bg-surface)', borderColor: 'var(--ssz-border-default)', color: 'var(--ssz-text-primary)' };
  }

  return (
    <div
      className="flex w-full flex-col"
      style={{ maxWidth: 540, padding: '36px 24px 120px' }}
    >
      {/* Eyebrow + question */}
      <p
        className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em]"
        style={{ color: 'oklch(0.44 0.09 168)' }}
      >
        {t('exLabel')}
      </p>
      <h2
        className="mb-6 text-[19px] font-bold leading-snug text-(--ssz-text-primary)"
        style={{ letterSpacing: '-0.01em' }}
      >
        {exercise.question}
      </h2>

      {/* Options */}
      <div className="mb-6 flex flex-col gap-2.5">
        {exercise.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            disabled={revealed}
            onClick={() => setSelectedIdx(i)}
            className={cn(
              'flex w-full items-center justify-between rounded-xl border-2 px-4 py-3.5',
              'font-reading text-[14.5px] font-medium transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
              revealed ? 'cursor-default' : 'cursor-pointer hover:brightness-95',
            )}
            style={{ ...optionStyle(i), transitionDuration: 'var(--ssz-duration-fast)', fontFamily: 'var(--ssz-font-reading)' }}
          >
            <span>{opt}</span>
            {revealed && i === exercise.correctIndex && (
              <Check size={15} style={{ color: SUCCESS_FG, flexShrink: 0, marginLeft: 8 }} aria-hidden="true" />
            )}
          </button>
        ))}
      </div>

      {/* Feedback bar (fixed) or Check CTA */}
      {revealed ? (
        <div
          className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3.5 px-7 py-4"
          style={{
            background: isCorrect ? 'oklch(0.96 0.04 145)' : 'oklch(0.97 0.025 15)',
            borderTop: `3px solid ${isCorrect ? 'oklch(0.76 0.11 145)' : 'oklch(0.88 0.07 15)'}`,
          }}
        >
          {/* Icon bubble */}
          <div
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full"
            style={{ background: isCorrect ? 'oklch(0.76 0.11 145 / 20%)' : 'oklch(0.88 0.07 15 / 20%)' }}
            aria-hidden="true"
          >
            {isCorrect
              ? <CheckCircle size={20} style={{ color: 'oklch(0.44 0.11 145)' }} />
              : <XCircle    size={20} style={{ color: 'oklch(0.44 0.105 15)' }} />}
          </div>

          {/* Label + explanation */}
          <div className="flex-1">
            <p
              className="mb-0.5 text-[14px] font-bold"
              style={{ color: isCorrect ? SUCCESS_FG : ERROR_FG }}
            >
              {isCorrect ? t('correct') : t('incorrect')}
            </p>
            {exercise.explanation && (
              <p className="text-[12.5px] text-(--ssz-text-secondary)">{exercise.explanation}</p>
            )}
          </div>

          {/* Continue button */}
          <button
            type="button"
            onClick={onContinue}
            className={cn(
              'shrink-0 rounded-xl px-6 py-2.5 text-[14px] font-bold text-white',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
              'transition-colors',
              isCorrect
                ? 'bg-(--ssz-color-primary-500) hover:bg-(--ssz-color-primary-600)'
                : 'bg-red-500 hover:bg-red-600',
            )}
            style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
          >
            {t('exContinue')}
          </button>
        </div>
      ) : (
        <BottomBar>
          <button
            type="button"
            disabled={selectedIdx === null}
            onClick={handleCheck}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-8 py-3',
              'text-[15px] font-bold text-white',
              'bg-(--ssz-color-primary-500) hover:bg-(--ssz-color-primary-600)',
              'disabled:pointer-events-none disabled:opacity-40',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
              'transition-colors',
            )}
            style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
          >
            {t('exCheck')}
          </button>
        </BottomBar>
      )}
    </div>
  );
}

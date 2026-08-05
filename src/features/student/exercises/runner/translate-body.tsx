'use client';

import { ArrowRight } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

import { Instr } from './instr';
import { modeAccentSoft, type RunnerMode, type RunnerPhase } from './types';

/**
 * Content schema for translate exercises.
 * `direction`:
 *   'to'   = source is in the learner's UI language, target is the learning language.
 *   'from' = source is in the learning language, target is the learner's UI language.
 */
export interface TranslateContent {
  direction: 'to' | 'from';
  /** Label for the source language, e.g. "English". */
  fromLabel: string;
  /** Label for the target language, e.g. "Norwegian". */
  toLabel: string;
  sourceText: string;
  /**
   * Canonical sample translation shown when the learner's answer is wrong (practice only).
   * Translation is open-ended — this is presented as a sample, not the only correct answer.
   */
  sampleAnswer: string;
  instruction?: string;
}

export interface TranslateBodyProps {
  content: TranslateContent;
  value: string;
  onValueChange: (val: string) => void;
  onAnswerChange: (canSubmit: boolean) => void;
  phase: RunnerPhase;
  /** null in graded mode — body never reveals correctness. */
  ok: boolean | null;
  mode: RunnerMode;
  accent: string;
}

const READING = 'var(--ssz-font-reading)';

export function TranslateBody({
  content,
  value,
  onValueChange,
  onAnswerChange,
  phase,
  ok,
  mode,
  accent,
}: TranslateBodyProps) {
  const t = useTranslations('ExerciseRunner');
  const accentSoft = modeAccentSoft(mode);
  const reveal = phase === 'feedback';
  const isAnswering = phase === 'answering';

  /* textarea border color — follows ok state on reveal */
  const ringColor =
    reveal && ok === false
      ? 'var(--ssz-feedback-no-line)'
      : reveal && ok === true
      ? 'var(--ssz-feedback-ok-line)'
      : accent;

  /* textarea border only changes on reveal */
  const textareaBorder = `2px solid ${reveal ? ringColor : 'var(--ssz-border-default)'}`;

  /* notify runner */
  useEffect(() => {
    onAnswerChange(value.trim() !== '');
  }, [value, onAnswerChange]);

  const instruction = content.instruction ?? t('translate.defaultInstruction');

  return (
    <>
      <Instr>{instruction}</Instr>

      {/* Source card */}
      <div
        className="mb-[18px]"
        style={{
          background: 'var(--ssz-bg-surface)',
          borderRadius: 14,
          padding: '18px 22px',
          border: '1.5px solid var(--ssz-border-default)',
          boxShadow: 'var(--ssz-shadow-sm)',
        }}
      >
        {/* From → To language row */}
        <div className="mb-2 flex items-center gap-2">
          <span
            className="text-[11px] font-bold uppercase"
            style={{ letterSpacing: '0.04em', color: 'var(--ssz-text-muted)' }}
          >
            {content.fromLabel}
          </span>
          <ArrowRight size={13} style={{ color: 'var(--ssz-text-muted)' }} aria-hidden="true" />
          <span
            className="text-[11px] font-bold uppercase"
            style={{ letterSpacing: '0.04em', color: accent }}
          >
            {content.toLabel}
          </span>
        </div>

        {/* Source sentence */}
        <div
          className="font-semibold"
          style={{
            fontFamily: READING,
            fontSize: 23,
            color: 'var(--ssz-text-primary)',
          }}
        >
          {content.sourceText}
        </div>
      </div>

      {/* Answer textarea */}
      <textarea
        value={value}
        disabled={!isAnswering}
        rows={2}
        aria-label={t('translate.textareaLabel')}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={t('translate.placeholder', { lang: content.toLabel })}
        style={{
          width: '100%',
          fontFamily: READING,
          fontSize: 19,
          fontWeight: 500,
          color: 'var(--ssz-text-primary)',
          padding: '14px 16px',
          borderRadius: 12,
          border: textareaBorder,
          background: 'var(--ssz-bg-base)',
          outline: 'none',
          resize: 'none',
          lineHeight: 1.5,
          boxShadow: reveal ? 'none' : undefined,
        }}
        className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ssz-border-focus)]"
      />

      {/* Sample answer block — practice only, wrong answer */}
      {reveal && ok === false && (
        <div
          className="mt-[14px]"
          style={{
            padding: '12px 16px',
            borderRadius: 10,
            background: accentSoft,
            border: `1.5px solid color-mix(in oklab, ${accent} 30%, transparent)`,
          }}
          aria-live="polite"
        >
          <div
            className="mb-1 text-[11px] font-bold uppercase"
            style={{ letterSpacing: '0.05em', color: 'var(--ssz-text-muted)' }}
          >
            {t('translate.sampleAnswer')}
          </div>
          <div
            className="font-semibold"
            style={{
              fontFamily: READING,
              fontSize: 18,
              color: 'var(--ssz-text-primary)',
            }}
          >
            {content.sampleAnswer}
          </div>
        </div>
      )}
    </>
  );
}

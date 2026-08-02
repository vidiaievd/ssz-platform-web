'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

import { Instr } from './instr';
import type { RunnerMode, RunnerPhase } from './types';

/**
 * Content schema for short-answer exercises.
 * `question` is the prompt; `context` is an optional passage/hint shown above it.
 */
export interface ShortAnswerContent {
  question: string;
  context?: string;
  instruction?: string;
}

export interface ShortAnswerExpectedAnswers {
  reference_answer: string;
  /** Optional exact-match shortcuts for instant auto-grading. */
  accepted_answers?: string[];
  explanation?: string;
}

export interface ShortAnswerBodyProps {
  content: ShortAnswerContent;
  /** Current free-text answer. */
  value: string;
  onValueChange: (val: string) => void;
  onAnswerChange: (canSubmit: boolean) => void;
  phase: RunnerPhase;
  /** null in graded mode or when the answer is routed for review. */
  ok: boolean | null;
  mode: RunnerMode;
  accent: string;
  /** Reference answer, revealed in the feedback phase. */
  referenceAnswer?: string;
}

const READING = 'var(--ssz-font-reading)';

export function ShortAnswerBody({
  content,
  value,
  onValueChange,
  onAnswerChange,
  phase,
  ok,
  accent,
  referenceAnswer,
}: ShortAnswerBodyProps) {
  const t = useTranslations('ExerciseRunner');
  const isAnswering = phase === 'answering';
  const reveal = phase === 'feedback';

  useEffect(() => {
    onAnswerChange(value.trim() !== '');
  }, [value, onAnswerChange]);

  const borderColor =
    reveal && ok === true
      ? 'var(--ssz-feedback-ok-line)'
      : reveal && ok === false
        ? 'var(--ssz-feedback-no-line)'
        : value.trim()
          ? accent
          : 'var(--ssz-border-default)';

  return (
    <>
      <Instr>{content.instruction ?? t('shortAnswer.defaultInstruction')}</Instr>

      {content.context && (
        <p className="mb-3 text-[13.5px] italic" style={{ color: 'var(--ssz-text-muted)' }}>
          {content.context}
        </p>
      )}

      <p
        className="mb-4 leading-[1.5]"
        style={{ fontFamily: READING, fontSize: 20, fontWeight: 500, color: 'var(--ssz-text-primary)' }}
      >
        {content.question}
      </p>

      <textarea
        value={value}
        disabled={!isAnswering}
        aria-label={t('shortAnswer.inputLabel')}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={t('shortAnswer.placeholder')}
        rows={3}
        style={{
          width: '100%',
          fontFamily: READING,
          fontSize: 17,
          color: 'var(--ssz-text-primary)',
          border: `2px solid ${borderColor}`,
          borderRadius: 12,
          background: 'var(--ssz-bg-surface)',
          padding: '12px 14px',
          outline: 'none',
          resize: 'vertical',
        }}
      />

      {reveal && referenceAnswer && (
        <div className="mt-4">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--ssz-text-muted)' }}>
            {t('shortAnswer.referenceLabel')}
          </p>
          <p className="text-[15px]" style={{ fontFamily: READING, color: 'var(--ssz-text-primary)' }}>
            {referenceAnswer}
          </p>
        </div>
      )}
    </>
  );
}

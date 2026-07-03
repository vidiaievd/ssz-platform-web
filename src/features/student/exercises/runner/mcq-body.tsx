'use client';

import { CheckCircle, XCircle } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

import { Instr } from './instr';
import { modeAccentSoft, type RunnerMode, type RunnerPhase } from './types';

export interface McqContent {
  question: string;
  options: { id: string; text: string }[];
  instruction?: string;
}

export interface McqExpectedAnswers {
  correct_option_ids: string[];
  explanation?: string;
}

export interface McqBodyProps {
  content: McqContent;
  expectedAnswers: McqExpectedAnswers;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Called whenever the answerable state changes (drives runner canSubmit). */
  onAnswerChange: (canSubmit: boolean) => void;
  phase: RunnerPhase;
  /** null in graded mode — body never reveals correctness. */
  ok: boolean | null;
  mode: RunnerMode;
  accent: string;
}

/* ── color constants ─────────────────────────────────────────────── */
const OK_BG   = 'var(--ssz-color-success-50)';
const OK_LINE = 'var(--ssz-color-success-500)';
const OK_FG   = 'oklch(0.40 0.12 145)';
const NO_BG   = 'var(--ssz-color-error-50)';
const NO_LINE = 'var(--ssz-color-error-500)';
const NO_FG   = 'var(--ssz-color-error-700)';

interface CellStyle {
  bg: string;
  border: string;
  color: string;
  opacity?: number;
}

function getOptionStyle(
  optionId: string,
  correctId: string,
  selectedId: string | null,
  phase: RunnerPhase,
  ok: boolean | null,
  accent: string,
  accentSoft: string,
): CellStyle {
  const isSel = optionId === selectedId;
  const isCorrect = optionId === correctId;
  const reveal = phase === 'feedback';

  if (reveal) {
    if (isCorrect && ok !== null) {
      return { bg: OK_BG, border: OK_LINE, color: OK_FG };
    }
    if (isSel && ok === false) {
      return { bg: NO_BG, border: NO_LINE, color: NO_FG };
    }
    if (isSel) {
      return { bg: accentSoft, border: accent, color: 'var(--ssz-text-primary)' };
    }
    return {
      bg: 'var(--ssz-bg-surface)',
      border: 'var(--ssz-border-default)',
      color: 'var(--ssz-text-muted)',
      opacity: 0.6,
    };
  }

  if (isSel) {
    return { bg: accentSoft, border: accent, color: 'var(--ssz-text-primary)' };
  }
  return { bg: 'var(--ssz-bg-surface)', border: 'var(--ssz-border-default)', color: 'var(--ssz-text-primary)' };
}

export function McqBody({
  content,
  expectedAnswers,
  selectedId,
  onSelect,
  onAnswerChange,
  phase,
  ok,
  mode,
  accent,
}: McqBodyProps) {
  const t = useTranslations('ExerciseRunner');
  const correctId = expectedAnswers.correct_option_ids[0] ?? '';
  const accentSoft = modeAccentSoft(mode);
  const isAnswering = phase === 'answering';
  const reveal = phase === 'feedback';

  /* notify runner of answerable state */
  useEffect(() => {
    onAnswerChange(selectedId !== null);
  }, [selectedId, onAnswerChange]);

  /* 1–4 keyboard shortcuts (BEHAVIOR.md §6) */
  useEffect(() => {
    if (!isAnswering) return;
    function onKeyDown(e: KeyboardEvent) {
      const tag = ((e.target as HTMLElement).tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) {
        const option = content.options[n - 1];
        if (option) onSelect(option.id);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAnswering, content.options, onSelect]);

  const instruction =
    content.instruction ?? t('mcq.defaultInstruction');

  return (
    <>
      <Instr>{instruction}</Instr>

      <h2
        className="mb-[22px] font-bold leading-[1.3]"
        style={{
          fontSize: 21,
          letterSpacing: '-0.01em',
          color: 'var(--ssz-text-primary)',
        }}
      >
        {content.question}
      </h2>

      <div
        role="radiogroup"
        aria-label={t('mcq.optionsLabel')}
        className="flex flex-col gap-[10px]"
      >
        {content.options.map((option, i) => {
          const s = getOptionStyle(option.id, correctId, selectedId, phase, ok, accent, accentSoft);
          const isSelected = option.id === selectedId;
          const isCorrect = option.id === correctId;
          const letter = String.fromCharCode(65 + i);

          const badgeBorder =
            reveal && (isCorrect && ok !== null)
              ? OK_LINE
              : reveal && isSelected && ok === false
              ? NO_LINE
              : isSelected
              ? accent
              : 'var(--ssz-border-strong)';

          return (
            <button
              key={option.id}
              role="radio"
              aria-checked={isSelected}
              disabled={!isAnswering}
              onClick={() => isAnswering && onSelect(option.id)}
              style={{
                textAlign: 'left',
                padding: '14px 16px',
                borderRadius: 12,
                cursor: isAnswering ? 'pointer' : 'default',
                border: `2px solid ${s.border}`,
                background: s.bg,
                color: s.color,
                opacity: s.opacity,
                fontFamily: 'inherit',
                transition: 'all 130ms var(--ssz-ease-out)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                outline: 'none',
              }}
              className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ssz-border-focus)]"
            >
              {/* Letter badge */}
              <span
                aria-hidden="true"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  flexShrink: 0,
                  border: `1.5px solid ${badgeBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  color: s.color,
                }}
              >
                {letter}
              </span>

              <span className="flex-1 text-[15px] font-medium">{option.text}</span>

              {/* Reveal icons (practice mode) */}
              {reveal && isCorrect && ok !== null && (
                <CheckCircle
                  size={18}
                  style={{ color: OK_LINE, flexShrink: 0 }}
                  aria-hidden="true"
                />
              )}
              {reveal && isSelected && ok === false && (
                <XCircle
                  size={18}
                  style={{ color: NO_LINE, flexShrink: 0 }}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

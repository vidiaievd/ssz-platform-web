'use client';

import { Lock } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

import { ExTopBar } from './ex-top-bar';
import { FeedbackBar } from './feedback-bar';
import { PrimaryFooter } from './primary-footer';
import { RunnerErrorBody } from './error-body';
import { RunnerLoadingBody } from './loading-body';
import { SetProgress } from './set-progress';
import { modeAccent, type FeedbackDensity, type RunnerMode, type RunnerPhase } from './types';

export interface ExerciseRunnerProps {
  mode: RunnerMode;
  /** 0-based index of the current item in the set. */
  idx: number;
  total: number;
  phase: RunnerPhase;
  /** Grading result: true = correct, false = incorrect, null = not yet graded / graded mode. */
  ok: boolean | null;
  canSubmit: boolean;
  /** "Unit 4 · Work & study" line shown below the mode label in the top bar. */
  unitLabel: string;
  feedbackDensity?: FeedbackDensity;
  /**
   * Correct answer text to display in the feedback bar when the learner was wrong (practice only).
   * Provided by the body; omit if you don't want to show an answer.
   */
  correctAnswer?: string | null;
  explanation?: string | null;
  isLoading?: boolean;
  isError?: boolean;
  onExit?: () => void;
  onSubmit: () => void;
  onAdvance: () => void;
  onRetry?: () => void;
  /** The exercise body for the current item. */
  children: React.ReactNode;
}

/**
 * Exercise Runner shell — top bar + scrollable body + sticky footer.
 * Does not manage phase state itself; receive phase/ok/canSubmit from useRunnerState.
 *
 * Keyboard shortcuts (global, see BEHAVIOR.md §6):
 * - Enter in answering phase (when canSubmit) → submit
 * - Enter in feedback phase → advance
 * - Shift+Enter inside a textarea → insert newline (not intercepted here)
 */
export function ExerciseRunner({
  mode,
  idx,
  total,
  phase,
  ok,
  canSubmit,
  unitLabel,
  feedbackDensity = 'minimal',
  correctAnswer,
  explanation,
  isLoading = false,
  isError = false,
  onExit,
  onSubmit,
  onAdvance,
  onRetry,
  children,
}: ExerciseRunnerProps) {
  const t = useTranslations('ExerciseRunner');
  const accent = modeAccent(mode);
  const isGraded = mode === 'graded';
  const showFeedback = phase === 'feedback' && !isLoading && !isError;
  const showFooter = !isLoading && !isError;
  const isLast = idx === total - 1;

  /* ── global keyboard handler (BEHAVIOR.md §6) ── */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isLoading || isError) return;
      const tag = ((e.target as HTMLElement).tagName ?? '').toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea';

      if (e.key === 'Enter') {
        if (isTyping && e.shiftKey) return; // Shift+Enter in textarea → newline
        e.preventDefault();
        if (phase === 'answering' && canSubmit) {
          onSubmit();
        } else if (phase === 'feedback') {
          onAdvance();
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isLoading, isError, phase, canSubmit, onSubmit, onAdvance]);

  return (
    <div
      className="flex h-dvh flex-col"
      style={{ background: 'var(--ssz-bg-base)', color: 'var(--ssz-text-primary)' }}
    >
      <ExTopBar
        mode={mode}
        idx={idx}
        total={total}
        unitLabel={unitLabel}
        accent={accent}
        onExit={onExit}
      />

      {/* Scrollable body — centered column */}
      <div className="flex flex-1 flex-col items-center overflow-y-auto">
        {isLoading ? (
          <RunnerLoadingBody />
        ) : isError ? (
          <RunnerErrorBody onRetry={onRetry} accent={accent} />
        ) : (
          <div className="w-full px-6 pb-10 pt-8.5" style={{ maxWidth: 560 }}>
            <SetProgress idx={idx} total={total} accent={accent} />

            {/* Graded mode persistent banner */}
            {isGraded && (
              <div
                className="mb-5.5 flex items-center gap-2.25 px-3.5 py-2.5"
                style={{
                  borderRadius: 10,
                  background: 'var(--ssz-color-secondary-100)',
                  border: '1.5px solid oklch(0.57 0.105 82 / 0.25)',
                }}
              >
                <Lock size={15} style={{ color: 'var(--ssz-color-secondary-700)', flexShrink: 0 }} aria-hidden="true" />
                <span
                  className="text-[12.5px] font-semibold"
                  style={{ color: 'var(--ssz-color-secondary-700)' }}
                >
                  {t('gradedBanner')}
                </span>
              </div>
            )}

            {children}
          </div>
        )}
      </div>

      {/* Footer — primary CTA or feedback affordance */}
      {showFooter && (
        showFeedback ? (
          <FeedbackBar
            mode={mode}
            ok={ok}
            density={feedbackDensity}
            correctAnswer={correctAnswer}
            explanation={explanation}
            isLast={isLast}
            accent={accent}
            onAdvance={onAdvance}
          />
        ) : (
          <PrimaryFooter
            mode={mode}
            canSubmit={canSubmit}
            accent={accent}
            onSubmit={onSubmit}
          />
        )
      )}
    </div>
  );
}

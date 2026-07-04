'use client';

import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { ExpandedExerciseRef } from '@/features/learning';
import { BottomBar, LearningSkeleton } from '@/features/learning';
import { useExerciseDisplay } from '@/features/content/api';
import type { ExerciseDisplay } from '@/features/content/types';
import {
  McqBody,
  FeedbackBar,
  gradeMcq,
} from '@/features/student/exercises/runner';
import type { McqContent, McqExpectedAnswers } from '@/features/student/exercises/runner';
import { cn } from '@/lib/utils';

/* ─── content parsing ───────────────────────────────────────────────────────── */

interface ParsedMcq {
  content: McqContent;
  expected: McqExpectedAnswers;
}

function parseMcq(display: ExerciseDisplay): ParsedMcq | null {
  const c = display.content;
  const question = typeof c.question === 'string' ? c.question : null;
  const rawOpts = Array.isArray(c.options) ? c.options : null;
  if (!question || !rawOpts) return null;

  const options = rawOpts.filter(
    (o): o is { id: string; text: string } =>
      typeof (o as Record<string, unknown>).id === 'string' &&
      typeof (o as Record<string, unknown>).text === 'string',
  );
  if (options.length === 0) return null;

  /* expected_answers may be nested or flat */
  const ea = (c.expected_answers as Record<string, unknown> | undefined) ?? c;
  const correctIds = Array.isArray(ea.correct_option_ids)
    ? (ea.correct_option_ids as string[])
    : [];

  return {
    content: { question, options, instruction: display.instructions ?? undefined },
    expected: {
      correct_option_ids: correctIds,
      explanation: typeof ea.explanation === 'string' ? ea.explanation : undefined,
    },
  };
}

/** Find the text of the correct option for feedback display. */
function correctAnswerText(mcq: ParsedMcq): string | null {
  const id = mcq.expected.correct_option_ids[0];
  return mcq.content.options.find((o) => o.id === id)?.text ?? null;
}

/* ─── PracticeItem — single exercise renderer ───────────────────────────────── */

interface PracticeItemProps {
  exRef: ExpandedExerciseRef;
  isLast: boolean;
  onResult: (ok: boolean, exerciseId: string) => void;
}

function PracticeItem({ exRef, isLast, onResult }: PracticeItemProps) {
  const t = useTranslations('Learning.practiceSection');
  const { data, isLoading, isError } = useExerciseDisplay(exRef.id);

  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [phase, setPhase]               = useState<'answering' | 'feedback'>('answering');
  const [correct, setCorrect]           = useState(false);

  if (isLoading) {
    return (
      <div className="mt-4">
        <LearningSkeleton variant="text" rows={6} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mt-8 flex flex-col items-center gap-4 text-center">
        <p className="text-[13.5px] text-(--ssz-text-secondary)">{t('loadError')}</p>
        <BottomBar>
          <button
            type="button"
            onClick={() => onResult(false, exRef.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-8 py-3',
              'text-[15px] font-bold text-white',
              'bg-(--ssz-color-primary-500) hover:bg-(--ssz-color-primary-600)',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
            )}
            style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
          >
            {isLast ? t('finish') : t('skip')}
          </button>
        </BottomBar>
      </div>
    );
  }

  const mcq = parseMcq(data);

  /* Unsupported exercise type — show skip */
  if (!mcq) {
    return (
      <div className="mt-8 flex flex-col gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-(--ssz-text-muted)">
          {t('unsupported')}
        </p>
        <BottomBar>
          <button
            type="button"
            onClick={() => onResult(false, exRef.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-8 py-3',
              'text-[15px] font-bold text-white',
              'bg-(--ssz-color-primary-500) hover:bg-(--ssz-color-primary-600)',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
            )}
            style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
          >
            {isLast ? t('finish') : t('skip')}
          </button>
        </BottomBar>
      </div>
    );
  }

  function handleSubmit() {
    if (!selectedId) return;
    const ok = gradeMcq(mcq!.expected, selectedId);
    setCorrect(ok);
    setPhase('feedback');
  }

  return (
    <>
      <McqBody
        content={mcq.content}
        expectedAnswers={mcq.expected}
        selectedId={selectedId}
        onSelect={(id) => { if (phase === 'answering') setSelectedId(id); }}
        onAnswerChange={() => { /* canSubmit derived from selectedId */ }}
        phase={phase}
        ok={phase === 'feedback' ? correct : null}
        mode="practice"
        accent="var(--ssz-color-primary-500)"
      />

      {phase === 'feedback' ? (
        <FeedbackBar
          mode="practice"
          ok={correct}
          density="minimal"
          correctAnswer={!correct ? correctAnswerText(mcq) : null}
          explanation={mcq.expected.explanation}
          isLast={isLast}
          accent="var(--ssz-color-primary-500)"
          onAdvance={() => onResult(correct, exRef.id)}
        />
      ) : (
        <BottomBar>
          <button
            type="button"
            disabled={selectedId === null}
            onClick={handleSubmit}
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
            {t('check')}
          </button>
        </BottomBar>
      )}
    </>
  );
}

/* ─── PracticeSection ────────────────────────────────────────────────────────── */

export interface PracticeSectionProps {
  exercises: ExpandedExerciseRef[];
  onComplete: (mistakes: string[]) => void;
}

export function PracticeSection({ exercises, onComplete }: PracticeSectionProps) {
  const t = useTranslations('Learning.practiceSection');
  const [idx, setIdx]         = useState(0);
  const [mistakes, setMistakes] = useState<string[]>([]);

  if (exercises.length === 0) {
    return (
      <div
        className="flex w-full flex-col items-center px-6 pt-24 text-center"
        style={{ maxWidth: 420 }}
      >
        <CheckCircle size={48} style={{ color: 'oklch(0.50 0.12 145)' }} aria-hidden="true" />
        <p className="mb-2 mt-5 text-[18px] font-bold text-(--ssz-text-primary)">{t('noPractice')}</p>
        <p className="mb-8 text-[13.5px] leading-[1.65] text-(--ssz-text-secondary)">
          {t('noPracticeBody')}
        </p>
        <BottomBar>
          <button
            type="button"
            onClick={() => onComplete([])}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-8 py-3',
              'text-[15px] font-bold text-white',
              'bg-(--ssz-color-primary-500) hover:bg-(--ssz-color-primary-600)',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
            )}
          >
            {t('seeResults')}
          </button>
        </BottomBar>
      </div>
    );
  }

  const cur = exercises[idx]!;
  const total = exercises.length;
  const isLast = idx === total - 1;

  function handleResult(ok: boolean, exerciseId: string) {
    const newMistakes = ok ? mistakes : [...mistakes, exerciseId];
    if (isLast) {
      onComplete(newMistakes);
    } else {
      setMistakes(newMistakes);
      setIdx((i) => i + 1);
    }
  }

  return (
    <div className="w-full" style={{ maxWidth: 540, padding: '28px 24px 20px' }}>
      {/* Progress pills */}
      <div className="mb-6 flex items-center gap-2.5">
        <div className="flex gap-1.5" aria-hidden="true">
          {exercises.map((_, i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                height: 6,
                width: i === idx ? 22 : 8,
                background: i <= idx ? 'var(--ssz-color-primary-500)' : 'var(--ssz-border-default)',
                opacity: i < idx ? 0.6 : i === idx ? 1 : 0.3,
                transition: 'all 260ms ease',
              }}
            />
          ))}
        </div>
        <span
          className="text-[12px] font-semibold text-(--ssz-text-muted)"
          aria-live="polite"
        >
          {t('progress', { current: idx + 1, total })}
        </span>
      </div>

      <PracticeItem
        key={cur.id}
        exRef={cur}
        isLast={isLast}
        onResult={handleResult}
      />
    </div>
  );
}

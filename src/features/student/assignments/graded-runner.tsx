'use client';

import { useReducer } from 'react';

import { ArrowRight, Check, ClipboardList, Eye, Play, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAssignmentQuestions, useSubmitGradedAssignment } from '@/features/learning/api/use-assignments';
import type { Assignment } from '@/features/learning/types';

/* ── State machine ─────────────────────────────────────────── */
type Phase = 'intro' | 'run' | 'done';

interface RunnerState {
  phase: Phase;
  idx: number;
  /** questionIndex → optionIndex */
  picks: Record<number, number>;
  score: number | null;
  correctItems: number | null;
}

type RunnerAction =
  | { type: 'START' }
  | { type: 'PICK'; idx: number; optionIndex: number }
  | { type: 'NEXT' }
  | { type: 'DONE'; score: number; correctItems: number };

function reducer(state: RunnerState, action: RunnerAction): RunnerState {
  switch (action.type) {
    case 'START':
      return { ...state, phase: 'run', idx: 0, picks: {} };
    case 'PICK':
      return { ...state, picks: { ...state.picks, [action.idx]: action.optionIndex } };
    case 'NEXT':
      return { ...state, idx: state.idx + 1 };
    case 'DONE':
      return { ...state, phase: 'done', score: action.score, correctItems: action.correctItems };
    default:
      return state;
  }
}

/* ── Shared card wrapper ───────────────────────────────────── */
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl p-[28px_30px] ${className}`}
      style={{
        background: 'var(--ssz-bg-surface)',
        border: '1.5px solid var(--ssz-border-default)',
        boxShadow: 'var(--ssz-shadow-xs)',
      }}
    >
      {children}
    </div>
  );
}

/* ── Loading skeleton ──────────────────────────────────────── */
function LoadingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading questions" className="space-y-4 max-w-[560px] mx-auto">
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-[200px] w-full rounded-2xl" />
    </div>
  );
}

/* ── Error state ───────────────────────────────────────────── */
function ErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('Assignments.error');
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-16 text-center">
      <span
        className="flex h-16 w-16 items-center justify-center rounded-[18px]"
        style={{ background: 'var(--ssz-color-error-50)' }}
      >
        <RefreshCw size={28} style={{ color: 'var(--ssz-color-error-500)' }} aria-hidden />
      </span>
      <p className="text-[17px] font-bold" style={{ color: 'var(--ssz-text-primary)' }}>{t('title')}</p>
      <p className="text-sm" style={{ color: 'var(--ssz-text-secondary)' }}>{t('body')}</p>
      <Button variant="outline" onClick={onRetry} className="mt-2">
        <RefreshCw size={14} aria-hidden />
        {t('retry')}
      </Button>
    </div>
  );
}

/* ── Graded runner ─────────────────────────────────────────── */
interface GradedRunnerProps {
  assignment: Assignment;
  onExit: () => void;
}

export function GradedRunner({ assignment: a, onExit }: GradedRunnerProps) {
  const t = useTranslations('Assignments.graded');
  const [state, dispatch] = useReducer(reducer, {
    phase: 'intro',
    idx: 0,
    picks: {},
    score: null,
    correctItems: null,
  });

  const { data, isLoading, isError, refetch } = useAssignmentQuestions(a.id);
  const submitMutation = useSubmitGradedAssignment(a.id);

  const questions = data?.questions ?? [];
  const total = questions.length;
  const currentQ = questions[state.idx];
  const picked = state.picks[state.idx];
  const isLast = state.idx === total - 1;

  async function handleSubmit() {
    const answers = questions.map((q, i) => ({
      questionId: q.id,
      optionIndex: state.picks[i] ?? -1,
    }));
    const result = await submitMutation.mutateAsync({ answers });
    dispatch({ type: 'DONE', score: result.score, correctItems: result.correctItems });
  }

  /* ── Intro phase ─── */
  if (state.phase === 'intro') {
    return (
      <div className="mx-auto max-w-[560px]">
        <Card>
          {/* Header */}
          <div className="mb-[18px] flex items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'var(--ssz-color-primary-100)' }}
              aria-hidden
            >
              <ClipboardList size={22} style={{ color: 'var(--ssz-color-primary-500)' }} />
            </span>
            <div>
              <h2 className="text-[18px] font-bold tracking-[-0.02em]" style={{ color: 'var(--ssz-text-primary)' }}>
                {a.title}
              </h2>
              <p className="text-[13px]" style={{ color: 'var(--ssz-text-secondary)' }}>
                {t('introSubtitle', { items: a.items ?? '?', est: a.est ?? '?' })}
              </p>
            </div>
          </div>

          {/* Info banner */}
          <div
            className="mb-5 flex items-start gap-2.5 rounded-xl p-[14px_16px]"
            style={{
              background: 'oklch(0.96 0.03 235)',
              border: '1.5px solid oklch(0.86 0.06 235)',
            }}
          >
            <Eye size={18} style={{ color: 'oklch(0.44 0.10 235)', flexShrink: 0 }} aria-hidden />
            <p className="text-[13px] leading-[1.55]" style={{ color: 'oklch(0.40 0.08 235)' }}>
              {t('infoBanner')}
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={onExit}>{t('back')}</Button>
            <Button variant="primary" size="lg" onClick={() => dispatch({ type: 'START' })}>
              <Play size={16} aria-hidden />
              {t('start')}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  /* ── Done phase ─── */
  if (state.phase === 'done') {
    return (
      <div className="mx-auto max-w-[560px]">
        <Card className="text-center">
          <span
            className="mx-auto mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-full"
            style={{ background: 'var(--ssz-color-success-100)' }}
            aria-hidden
          >
            <Check size={36} style={{ color: 'var(--ssz-color-success-500)' }} />
          </span>
          <p
            className="mb-1.5 text-[13px] font-bold uppercase tracking-[0.06em]"
            style={{ color: 'var(--ssz-text-muted)' }}
          >
            {t('doneLabel')}
          </p>
          <p
            className="text-[40px] font-extrabold tracking-[-0.03em]"
            style={{ color: 'var(--ssz-text-primary)' }}
          >
            {t('doneScore', { score: state.score ?? 0 })}
          </p>
          <p className="mb-[22px] mt-1.5 text-[14px]" style={{ color: 'var(--ssz-text-secondary)' }}>
            {t('doneDetail', { correct: state.correctItems ?? 0, total })}
          </p>
          <Button variant="primary" size="lg" onClick={onExit}>
            {t('doneBack')}
          </Button>
        </Card>
      </div>
    );
  }

  /* ── Run phase ─── */
  if (isLoading) return <LoadingSkeleton />;
  if (isError || !currentQ) return <ErrorState onRetry={() => void refetch()} />;

  const progressPct = total > 0 ? (state.idx / total) * 100 : 0;

  return (
    <div className="mx-auto max-w-[560px]">
      {/* Progress bar + counter */}
      <div className="mb-[22px] flex items-center gap-3">
        <div
          className="h-2 flex-1 overflow-hidden rounded-full"
          style={{ background: 'var(--ssz-bg-muted)' }}
          role="progressbar"
          aria-valuenow={state.idx + 1}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-label={t('counter', { current: state.idx + 1, total })}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${progressPct}%`,
              background: 'var(--ssz-color-primary-500)',
              transition: 'width 220ms cubic-bezier(0.16,1,0.3,1)',
            }}
          />
        </div>
        <span className="shrink-0 text-[13px] font-semibold" style={{ color: 'var(--ssz-text-secondary)' }}>
          {t('counter', { current: state.idx + 1, total })}
        </span>
      </div>

      <Card>
        {/* Graded pill */}
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
          style={{
            background: 'oklch(0.94 0.04 235)',
            color: 'oklch(0.42 0.10 235)',
          }}
        >
          <Eye size={12} aria-hidden />
          {t('pill')}
        </span>

        {/* Question text — Lora reading font */}
        <p
          className="my-[18px] mb-[22px] text-[22px] font-medium leading-[1.4]"
          style={{
            fontFamily: 'var(--ssz-font-reading)',
            color: 'var(--ssz-text-primary)',
          }}
        >
          {currentQ.text}
        </p>

        {/* MCQ options */}
        <div className="flex flex-col gap-2.5" role="group" aria-label="Answer options">
          {currentQ.options.map((opt, i) => {
            const isSelected = picked === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => dispatch({ type: 'PICK', idx: state.idx, optionIndex: i })}
                aria-pressed={isSelected}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3.5 text-left text-[15px] font-medium transition-all duration-140"
                style={{
                  border: `1.5px solid ${isSelected ? 'var(--ssz-color-primary-500)' : 'var(--ssz-border-default)'}`,
                  background: isSelected ? 'oklch(0.62 0.105 168 / 0.07)' : 'var(--ssz-bg-surface)',
                  color: 'var(--ssz-text-primary)',
                }}
              >
                {/* Radio circle */}
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  style={{
                    border: `1.5px solid ${isSelected ? 'var(--ssz-color-primary-500)' : 'var(--ssz-border-strong)'}`,
                    background: isSelected ? 'var(--ssz-color-primary-500)' : 'transparent',
                  }}
                  aria-hidden
                >
                  {isSelected && <Check size={13} color="#fff" strokeWidth={2.5} />}
                </span>
                {opt}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" onClick={onExit}>{t('saveExit')}</Button>
          {isLast ? (
            <Button
              variant="primary"
              disabled={picked === undefined || submitMutation.isPending}
              onClick={() => void handleSubmit()}
            >
              {submitMutation.isPending
                ? <span className="animate-spin" aria-hidden><RefreshCw size={15} /></span>
                : null}
              {t('submitForGrading')}
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={picked === undefined}
              onClick={() => dispatch({ type: 'NEXT' })}
            >
              {t('next')}
              <ArrowRight size={15} aria-hidden />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { AudioPlayer } from '@/features/learning';
import { normAnswer } from '@/features/student/exercises/runner';

import type { ListeningGapFillItem } from '../lib/parse-listening-exercise';

export interface ListeningGapFillStageProps {
  items: ListeningGapFillItem[];
  audioSrc?: string;
  audioLabel: string;
  onNext: (missedExerciseIds: string[]) => void;
}

export function ListeningGapFillStage({ items, audioSrc, audioLabel, onNext }: ListeningGapFillStageProps) {
  const t = useTranslations('Learning.reader.listening.gapfill');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);

  const allAnswered = items.every((g) => answers[g.exerciseId]);
  const results = useMemo(
    () =>
      items.map((g) => ({
        item: g,
        correct: normAnswer(answers[g.exerciseId] ?? '') === normAnswer(g.answer),
      })),
    [items, answers],
  );
  const correctCount = results.filter((r) => r.correct).length;

  function handleCheck() {
    setChecked(true);
  }

  function handleNext() {
    onNext(results.filter((r) => !r.correct).map((r) => r.item.exerciseId));
  }

  return (
    <div>
      <h2 className="font-reading mb-1.5 text-[23px] font-semibold text-(--ssz-text-primary)">
        {t('heading')}
      </h2>
      <p className="mb-5.5 text-[13.5px] text-(--ssz-text-secondary)">{t('body')}</p>
      <div className="mb-5.5">
        <AudioPlayer src={audioSrc} label={audioLabel} compact />
      </div>

      <div className="flex flex-col gap-5">
        {items.map((g, i) => {
          const chosen = answers[g.exerciseId];
          const result = checked ? normAnswer(chosen ?? '') === normAnswer(g.answer) : null;
          return (
            <div
              key={g.exerciseId}
              className="rounded-2xl border-[1.5px] px-4.5 py-4"
              style={{
                background: 'var(--ssz-bg-surface)',
                borderColor:
                  result === true
                    ? 'var(--ssz-color-success-500)'
                    : result === false
                      ? 'var(--ssz-color-error-500)'
                      : 'var(--ssz-border-default)',
                boxShadow: 'var(--ssz-shadow-xs)',
              }}
            >
              <p className="font-reading mb-3.5 text-[17px] leading-[1.7] text-(--ssz-text-primary)">
                <span className="mr-2 font-sans text-[11px] font-bold text-(--ssz-text-muted)">{i + 1}.</span>
                {g.before}{' '}
                <span
                  className="inline-block min-w-24 rounded-lg px-3 py-0.5 text-center font-sans text-[15px] font-semibold"
                  style={{
                    background: chosen
                      ? checked
                        ? result
                          ? 'var(--ssz-color-success-100)'
                          : 'var(--ssz-color-error-100)'
                        : 'var(--ssz-color-primary-50)'
                      : 'var(--ssz-bg-subtle)',
                    color: chosen
                      ? checked
                        ? result
                          ? 'var(--ssz-color-success-700)'
                          : 'var(--ssz-color-error-700)'
                        : 'var(--ssz-color-primary-700)'
                      : 'var(--ssz-text-muted)',
                    border: `1.5px ${chosen ? 'solid' : 'dashed'} ${
                      chosen
                        ? checked
                          ? result
                            ? 'var(--ssz-color-success-500)'
                            : 'var(--ssz-color-error-500)'
                          : 'var(--ssz-color-primary-500)'
                        : 'var(--ssz-border-strong)'
                    }`,
                  }}
                >
                  {chosen || '____'}
                </span>{' '}
                {g.after}
              </p>
              <div className="flex flex-wrap gap-2">
                {g.wordBank.map((option) => {
                  const selected = chosen === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={checked}
                      onClick={() => setAnswers((a) => ({ ...a, [g.exerciseId]: option }))}
                      aria-pressed={selected}
                      className="rounded-full px-4 py-1.5 text-[13.5px] font-semibold transition-colors disabled:cursor-default"
                      style={{
                        border: `1.5px solid ${selected ? 'var(--ssz-color-primary-500)' : 'var(--ssz-border-default)'}`,
                        background: selected ? 'var(--ssz-color-primary-50)' : 'var(--ssz-bg-base)',
                        color: selected ? 'var(--ssz-color-primary-700)' : 'var(--ssz-text-secondary)',
                        cursor: checked ? 'default' : 'pointer',
                        transitionDuration: 'var(--ssz-duration-fast)',
                      }}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              {result === false && (
                <div className="mt-2.5 text-[12.5px]" style={{ color: 'var(--ssz-color-error-700)' }}>
                  {t('answerLabel', { answer: g.answer })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6.5 flex flex-wrap items-center justify-between gap-3">
        {checked ? (
          <span className="text-sm font-semibold text-(--ssz-text-secondary)">
            <span
              className="font-extrabold"
              style={{
                color:
                  correctCount === items.length
                    ? 'var(--ssz-color-success-500)'
                    : 'var(--ssz-color-primary-700)',
              }}
            >
              {t('correctCount', { correct: correctCount, total: items.length })}
            </span>
          </span>
        ) : (
          <span />
        )}
        {checked ? (
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-2 rounded-xl bg-(--ssz-color-primary-500) px-7 py-3 text-[15px] font-bold text-white transition-colors hover:bg-(--ssz-color-primary-600) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
            style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
          >
            {t('next')}
          </button>
        ) : (
          <button
            type="button"
            disabled={!allAnswered}
            onClick={handleCheck}
            className="inline-flex items-center gap-2 rounded-xl bg-(--ssz-color-primary-500) px-7 py-3 text-[15px] font-bold text-white transition-colors hover:bg-(--ssz-color-primary-600) disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
            style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
          >
            {t('checkAnswers')}
          </button>
        )}
      </div>
    </div>
  );
}

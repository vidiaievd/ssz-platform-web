'use client';

import { Check, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { AudioPlayer } from '@/features/learning';

import type { ListeningComprehensionItem, StageSurface } from '../lib/parse-listening-exercise';

export interface ListeningCompStageProps {
  items: ListeningComprehensionItem[];
  audioSrc?: string;
  /** Omitted on the text surface, where there is no clip to replay — the player is then not rendered at all. */
  audioLabel?: string;
  /** Selects the copy set; the questions themselves are the same. Defaults to the listening flow. */
  surface?: StageSurface;
  onDone: (missedExerciseIds: string[]) => void;
}

export function ListeningCompStage({
  items,
  audioSrc,
  audioLabel,
  surface = 'audio',
  onDone,
}: ListeningCompStageProps) {
  const t = useTranslations(
    surface === 'text' ? 'Learning.reader.text.check.comp' : 'Learning.reader.listening.comp',
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);

  const allAnswered = items.every((q) => answers[q.exerciseId] !== undefined);
  const results = useMemo(
    () => items.map((q) => ({ item: q, correct: answers[q.exerciseId] === q.correctOptionId })),
    [items, answers],
  );
  const score = results.filter((r) => r.correct).length;

  return (
    <div>
      <h2 className="font-reading mb-1.5 text-[23px] font-semibold text-(--ssz-text-primary)">
        {t('heading')}
      </h2>
      <p className="mb-3 text-[13.5px] text-(--ssz-text-secondary)">{t('body')}</p>
      {audioLabel !== undefined && (
        <div className="mb-5.5">
          <AudioPlayer src={audioSrc} label={audioLabel} compact />
        </div>
      )}

      <div className="flex flex-col gap-4.5">
        {items.map((q, i) => {
          const selected = answers[q.exerciseId];
          return (
            <div
              key={q.exerciseId}
              className="rounded-2xl border-[1.5px] border-(--ssz-border-default) px-4.5 py-4"
              style={{ background: 'var(--ssz-bg-surface)', boxShadow: 'var(--ssz-shadow-xs)' }}
            >
              <div className="font-reading mb-3 text-[16.5px] font-semibold text-(--ssz-text-primary)">
                <span className="mr-2 font-sans text-[11px] font-bold text-(--ssz-text-muted)">{i + 1}.</span>
                {q.question}
              </div>
              <div className="flex flex-col gap-2" role="radiogroup" aria-label={q.question}>
                {q.options.map((option) => {
                  const isSelected = selected === option.id;
                  const isRight = checked && option.id === q.correctOptionId;
                  const isWrong = checked && isSelected && option.id !== q.correctOptionId;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={checked}
                      onClick={() => setAnswers((a) => ({ ...a, [q.exerciseId]: option.id }))}
                      className="flex items-center gap-2.75 rounded-[11px] px-3.5 py-2.75 text-left text-[14.5px] font-medium transition-colors disabled:cursor-default"
                      style={{
                        border: `1.5px solid ${
                          isRight
                            ? 'var(--ssz-feedback-ok-line)'
                            : isWrong
                              ? 'var(--ssz-feedback-no-line)'
                              : isSelected
                                ? 'var(--ssz-color-primary-500)'
                                : 'var(--ssz-border-default)'
                        }`,
                        background: isRight
                          ? 'var(--ssz-feedback-ok-bg)'
                          : isWrong
                            ? 'var(--ssz-feedback-no-bg)'
                            : isSelected
                              ? 'var(--ssz-color-primary-50)'
                              : 'var(--ssz-bg-base)',
                        color: isRight
                          ? 'var(--ssz-feedback-ok-fg)'
                          : isWrong
                            ? 'var(--ssz-feedback-no-fg)'
                            : 'var(--ssz-text-primary)',
                        cursor: checked ? 'default' : 'pointer',
                        transitionDuration: 'var(--ssz-duration-fast)',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full"
                        style={{
                          border: `1.5px solid ${
                            isRight
                              ? 'var(--ssz-feedback-ok-line)'
                              : isWrong
                                ? 'var(--ssz-feedback-no-line)'
                                : isSelected
                                  ? 'var(--ssz-color-primary-500)'
                                  : 'var(--ssz-border-strong)'
                          }`,
                          background: isRight
                            ? 'var(--ssz-feedback-ok-line)'
                            : isWrong
                              ? 'var(--ssz-feedback-no-line)'
                              : isSelected
                                ? 'var(--ssz-color-primary-500)'
                                : 'transparent',
                        }}
                      >
                        {(isRight || isSelected) &&
                          (isWrong ? (
                            <X size={13} color="#fff" aria-hidden="true" />
                          ) : (
                            <Check size={13} color="#fff" aria-hidden="true" />
                          ))}
                      </span>
                      {option.text}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6.5 flex flex-wrap items-center justify-between gap-3">
        {checked ? (
          <span
            className="text-sm font-extrabold"
            style={{
              color: score === items.length ? 'var(--ssz-feedback-ok-line)' : 'var(--ssz-color-primary-700)',
            }}
          >
            {t('score', { score, total: items.length })}
          </span>
        ) : (
          <span />
        )}
        {checked ? (
          <button
            type="button"
            onClick={() => onDone(results.filter((r) => !r.correct).map((r) => r.item.exerciseId))}
            className="inline-flex items-center gap-2 rounded-xl bg-(--ssz-color-primary-500) px-7 py-3 text-[15px] font-bold text-white transition-colors hover:bg-(--ssz-color-primary-600) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
            style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
          >
            {t('finish')}
          </button>
        ) : (
          <button
            type="button"
            disabled={!allAnswered}
            onClick={() => setChecked(true)}
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

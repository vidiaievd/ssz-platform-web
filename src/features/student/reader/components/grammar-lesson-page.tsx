'use client';

import { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  buildGlossaryIndex,
  ErrorState,
  HighlightedSentence,
  LearningSkeleton,
  LessonProse,
} from '@/features/learning';
import { useGrammarRule, useBestGrammarExplanation } from '@/features/content';
import { useMyStudentProfile } from '@/features/profile';
import { cn } from '@/lib/utils';

export interface GrammarLessonPageProps {
  ruleId: string;
  unitPosition: number;
  courseTitle: string;
  cefrLevel: string;
}

const GRAMMAR_HUE = '--ssz-type-grammar';

/** Module-level so the prose does not re-render on an identity change alone. */
const EMPTY_GLOSSARY = buildGlossaryIndex([]);

interface QuickCheckProps {
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

function QuickCheck({ question, options, correctOptionIndex, explanation }: QuickCheckProps) {
  const t = useTranslations('Learning.reader.grammar.quickCheck');
  const [pick, setPick] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const isCorrectPick = checked && pick === correctOptionIndex;

  return (
    <div className="rounded-2xl border-[1.5px] border-(--ssz-border-default) bg-surface px-5.5 py-5 shadow-(--ssz-shadow-sm)">
      <div className="mb-2.5 text-[10.5px] font-bold tracking-wider text-(--ssz-text-muted) uppercase">
        {t('label')}
      </div>
      <div className="font-reading mb-4 text-[17px] font-semibold text-(--ssz-text-primary)">{question}</div>
      <div role="radiogroup" aria-label={question} className="flex flex-col gap-2.25">
        {options.map((option, i) => {
          const selected = pick === i;
          const isRight = checked && i === correctOptionIndex;
          const isWrong = checked && selected && i !== correctOptionIndex;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={checked}
              onClick={() => setPick(i)}
              className={cn(
                'font-reading flex items-center gap-2.75 rounded-[11px] border-[1.5px] px-3.75 py-3 text-left text-[15.5px]',
                'transition-colors disabled:cursor-default',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
              )}
              style={{
                borderColor: isRight
                  ? 'var(--ssz-feedback-ok-line)'
                  : isWrong
                    ? 'var(--ssz-feedback-no-line)'
                    : selected
                      ? `var(${GRAMMAR_HUE})`
                      : 'var(--ssz-border-default)',
                background: isRight
                  ? 'var(--ssz-feedback-ok-bg)'
                  : isWrong
                    ? 'var(--ssz-feedback-no-bg)'
                    : selected
                      ? `color-mix(in oklch, var(${GRAMMAR_HUE}) 12%, transparent)`
                      : 'var(--ssz-bg-base)',
                color: isRight
                  ? 'var(--ssz-feedback-ok-fg)'
                  : isWrong
                    ? 'var(--ssz-feedback-no-fg)'
                    : 'var(--ssz-text-primary)',
                transitionDuration: 'var(--ssz-duration-fast)',
              }}
            >
              <span
                className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full border-[1.5px]"
                style={{
                  borderColor: isRight
                    ? 'var(--ssz-feedback-ok-line)'
                    : isWrong
                      ? 'var(--ssz-feedback-no-line)'
                      : selected
                        ? `var(${GRAMMAR_HUE})`
                        : 'var(--ssz-border-strong)',
                  background: isRight
                    ? 'var(--ssz-feedback-ok-line)'
                    : isWrong
                      ? 'var(--ssz-feedback-no-line)'
                      : selected
                        ? `var(${GRAMMAR_HUE})`
                        : 'transparent',
                }}
              >
                {(isRight || selected) && (
                  <>
                    {isWrong ? (
                      <X size={13} className="text-white" aria-hidden="true" />
                    ) : (
                      <Check size={13} className="text-white" aria-hidden="true" />
                    )}
                  </>
                )}
              </span>
              {option}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-3.5">
        {!checked ? (
          <button
            type="button"
            disabled={pick === null}
            onClick={() => setChecked(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-(--ssz-color-primary-500) px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-(--ssz-color-primary-600) disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
            style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
          >
            {t('checkAnswer')}
          </button>
        ) : (
          <p className="text-[13.5px] leading-[1.6] text-(--ssz-text-secondary)">
            <strong
              style={{
                color: isCorrectPick ? 'var(--ssz-feedback-ok-line)' : 'var(--ssz-feedback-no-line)',
              }}
            >
              {isCorrectPick ? t('correct') : t('incorrect')}{' '}
            </strong>
            {explanation}
          </p>
        )}
      </div>
    </div>
  );
}

export function GrammarLessonPage({ ruleId, unitPosition, courseTitle, cefrLevel }: GrammarLessonPageProps) {
  const t = useTranslations('Learning.reader.grammar.page');
  const tAnchor = useTranslations('Learning.reader.grammar.anchor');
  const tCompare = useTranslations('Learning.reader.grammar.compare');
  const tContent = useTranslations('Content');

  const rule = useGrammarRule(ruleId);
  const profile = useMyStudentProfile();
  const nativeLanguage = profile.data?.nativeLanguage ?? undefined;
  const profileReady = !profile.isLoading && !!nativeLanguage;

  const explanation = useBestGrammarExplanation(ruleId, nativeLanguage ?? '', cefrLevel, profileReady);
  const anchorText = explanation.data?.anchorText;
  const anchorHighlights = explanation.data?.anchorHighlights;

  const highlightedAnchor = useMemo(
    () =>
      anchorText ? (
        <HighlightedSentence sentence={anchorText} highlights={anchorHighlights ?? []} />
      ) : null,
    [anchorText, anchorHighlights],
  );

  const isLoading = rule.isLoading || profile.isLoading || (profileReady && explanation.isLoading);
  const isError = rule.isError || profile.isError || (profileReady && explanation.isError);

  if (isLoading) {
    return <LearningSkeleton variant="card" rows={4} />;
  }

  if (isError || !rule.data) {
    return (
      <ErrorState
        onRetry={() => {
          rule.refetch();
          profile.refetch();
          if (profileReady) explanation.refetch();
        }}
      />
    );
  }

  if (!profileReady || !explanation.data) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 rounded-2xl border border-(--ssz-border-default) bg-surface px-6 py-16 text-center">
        <p className="text-lg font-medium text-(--ssz-text-primary)">{t('emptyTitle')}</p>
        <p className="text-sm text-(--ssz-text-muted)">{t('emptyBody')}</p>
      </div>
    );
  }

  const data = explanation.data;

  return (
    <div>
      <div className="mb-4.5">
        <div className="mb-1.5 text-[11px] font-bold tracking-wider text-(--ssz-color-primary-600) uppercase">
          {t('eyebrow', { unit: unitPosition, course: courseTitle, type: tContent('materialType.grammar') })}
        </div>
        <h1 className="font-reading mb-1.5 text-[29px] leading-[1.15] font-semibold tracking-tight text-(--ssz-text-primary)">
          {data.title}
        </h1>
      </div>

      {/*
        Rendered as markdown, not as plain text: an explanation is authored with
        headings and paradigm tables, and printing its source would put `|---|`
        in front of the reader. No glossary here — a grammar lesson explains the
        rule, and word lookups belong to the texts that use it.
      */}
      <LessonProse
        text={data.body}
        glossary={EMPTY_GLOSSARY}
        lang={rule.data.targetLanguage}
        className="mb-5.5 max-w-150 text-base leading-[1.7]"
      />

      {data.anchorText && (
        <div
          className="mb-6.5 rounded-2xl border-[1.5px] px-6 py-5.5"
          style={{
            background: `color-mix(in oklch, var(${GRAMMAR_HUE}) 10%, transparent)`,
            borderColor: `color-mix(in oklch, var(${GRAMMAR_HUE}) 28%, transparent)`,
          }}
        >
          <div
            className="mb-2.5 text-[10.5px] font-bold tracking-wider uppercase"
            style={{ color: `var(${GRAMMAR_HUE})` }}
          >
            {tAnchor('label')}
          </div>
          <p className="font-reading mb-3 text-[22px] leading-normal text-(--ssz-text-primary)">
            {highlightedAnchor}
          </p>
          {data.anchorNote && (
            <div className="text-[13.5px] leading-[1.6] text-(--ssz-text-secondary)">{data.anchorNote}</div>
          )}
        </div>
      )}

      {data.compareExamples.length > 0 && (
        <div className="mb-7.5">
          <div className="mb-3 text-sm font-bold text-(--ssz-text-primary)">{tCompare('heading')}</div>
          <div className="flex flex-col gap-2.5">
            {data.compareExamples.map((ex) => (
              <div
                key={ex.id}
                className="flex items-start gap-3 rounded-xl border-[1.5px] bg-surface px-4 py-3.25"
                style={{
                  borderColor: ex.isCorrect
                    ? 'color-mix(in oklch, var(--ssz-feedback-ok-line) 40%, transparent)'
                    : 'color-mix(in oklch, var(--ssz-feedback-no-line) 40%, transparent)',
                }}
              >
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: ex.isCorrect
                      ? 'color-mix(in oklch, var(--ssz-feedback-ok-line) 18%, transparent)'
                      : 'color-mix(in oklch, var(--ssz-feedback-no-line) 14%, transparent)',
                  }}
                >
                  {ex.isCorrect ? (
                    <Check size={14} style={{ color: 'var(--ssz-feedback-ok-line)' }} aria-hidden="true" />
                  ) : (
                    <X size={14} style={{ color: 'var(--ssz-feedback-no-line)' }} aria-hidden="true" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-reading text-base text-(--ssz-text-primary)">{ex.sentence}</div>
                  {ex.note && <div className="mt-0.5 text-xs text-(--ssz-text-muted)">{ex.note}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.quickCheck && (
        <QuickCheck
          question={data.quickCheck.question}
          options={data.quickCheck.options}
          correctOptionIndex={data.quickCheck.correctOptionIndex}
          explanation={data.quickCheck.explanation}
        />
      )}
    </div>
  );
}

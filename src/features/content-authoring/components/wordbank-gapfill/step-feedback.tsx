'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { Input, Textarea } from '@/components/ui/input';
import { ProgressBar } from '@/components/ui/progress';
import { Segmented } from '@/components/ui/segmented';
import {
  bank,
  coverage,
  feedbackFor,
  gaps,
  type Gap,
  type WordBankGapFill,
} from '@/lib/shared-kernel/wordbank-gapfill';

import { gapCoverage, setFallback, setPairText, setWhy } from './edits';
import { FeedbackMatrix } from './feedback-matrix';
import { SentenceWithAnswer } from './sentence-preview';

const READING = 'var(--ssz-font-reading)';

type GapFeedbackView = 'list' | 'matrix';

export interface StepFeedbackProps {
  exercise: WordBankGapFill;
  onChange: (next: WordBankGapFill) => void;
  disabled?: boolean;
}

/**
 * Step 3 of the gap-fill builder, by-gap view: what the student is told after a check.
 *
 * The shape of the step is the design's central bet. Feedback is authored per pair —
 * this gap × that wrong word — and that grid grows as fast as the bank does, so only the
 * per-gap default is required and the pair text is treated as coverage the teacher fills
 * in over time. Empty rows are legitimate, and say what would be shown instead.
 */
export function StepFeedback({ exercise, onChange, disabled = false }: StepFeedbackProps) {
  const t = useTranslations('Authoring');
  const allGaps = gaps(exercise);
  const totals = coverage(exercise);
  const isBank = exercise.settings.input === 'bank';

  /** AC-B18: hides written pair rows only — never the default or the why. */
  const [onlyMissing, setOnlyMissing] = useState(false);
  /**
   * Two views over the same data (BEHAVIOR §1.4). The list is where one gap's feedback
   * is written carefully; the matrix is where a run of pairs is filled in. Neither is a
   * mode — nothing is stored about which one the teacher last used.
   */
  const [view, setView] = useState<GapFeedbackView>('list');

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold">{t('gapFill.step3.title')}</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">{t('gapFill.step3.lede')}</p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">
            {t('gapFill.step3.coverage', { written: totals.written, total: totals.total })}
          </p>
          {isBank && (
            <div className="flex items-center gap-3">
              {view === 'list' && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={onlyMissing}
                    disabled={disabled}
                    onCheckedChange={(checked) => setOnlyMissing(checked === true)}
                  />
                  {t('gapFill.step3.onlyMissing')}
                </label>
              )}
              <Segmented
                size="sm"
                options={[
                  { value: 'list', label: t('gapFill.step3.viewList') },
                  { value: 'matrix', label: t('gapFill.step3.viewMatrix') },
                ]}
                value={view}
                aria-label={t('gapFill.step3.viewLabel')}
                onValueChange={setView}
              />
            </div>
          )}
        </div>

        {isBank && <ProgressBar value={totals.pct} label={t('gapFill.step3.coverageBar')} />}

        {totals.noFallback > 0 && (
          <p role="alert" className="flex items-center gap-1.5 text-xs text-error">
            <AlertCircle className="size-3.5" aria-hidden />
            {t('gapFill.step3.missingFallbacks', { count: totals.noFallback })}
          </p>
        )}
      </div>

      {allGaps.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('gapFill.step3.empty')}</p>
      ) : isBank && view === 'matrix' ? (
        <FeedbackMatrix exercise={exercise} onChange={onChange} disabled={disabled} />
      ) : (
        <ul className="flex flex-col gap-3">
          {allGaps.map((gap) => (
            <li key={gap.key}>
              <GapCard
                exercise={exercise}
                gap={gap}
                onlyMissing={onlyMissing}
                disabled={disabled}
                onChange={onChange}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface GapCardProps {
  exercise: WordBankGapFill;
  gap: Gap;
  onlyMissing: boolean;
  disabled: boolean;
  onChange: (next: WordBankGapFill) => void;
}

function GapCard({ exercise, gap, onlyMissing, disabled, onChange }: GapCardProps) {
  const t = useTranslations('Authoring');
  const feedback = feedbackFor(exercise, gap.key);
  const own = gapCoverage(exercise, gap.key, gap.answer);
  const missingFallback = feedback.fallback.trim() === '';
  const isBank = exercise.settings.input === 'bank';

  const wrongWords = isBank
    ? bank(exercise)
        .map(({ word }) => word)
        .filter((word) => word !== gap.answer)
    : [];

  const rows = wrongWords.filter((word) => {
    if (!onlyMissing) return true;
    const pair = feedback.pairs[word];
    return pair === undefined || pair.origin !== 'author' || pair.text.trim() === '';
  });

  return (
    <div
      className={`rounded-lg border bg-surface ${missingFallback ? 'border-error' : 'border-border'}`}
    >
      <div className="flex items-baseline gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-semibold">{gap.label}</span>
        <SentenceWithAnswer gap={gap} className="truncate" />
        <span className="flex-1" />
        {isBank && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {t('gapFill.step3.gapCoverage', { written: own.written, total: own.total })}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3 p-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" htmlFor={`fallback-${gap.key}`}>
            {t('gapFill.step3.fallbackLabel')}
          </label>
          <Textarea
            id={`fallback-${gap.key}`}
            rows={2}
            value={feedback.fallback}
            disabled={disabled}
            hasError={missingFallback}
            aria-invalid={missingFallback}
            placeholder={t('gapFill.step3.fallbackPlaceholder')}
            onChange={(event) => onChange(setFallback(exercise, gap.key, event.target.value))}
          />
          {missingFallback ? (
            <p role="alert" className="flex items-center gap-1.5 text-xs text-error">
              <AlertCircle className="size-3.5" aria-hidden />
              {t('gapFill.step3.fallbackRequired')}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{t('gapFill.step3.fallbackHelp')}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" htmlFor={`why-${gap.key}`}>
            {t('gapFill.step3.whyLabel')}
          </label>
          <Textarea
            id={`why-${gap.key}`}
            rows={2}
            value={feedback.why}
            disabled={disabled}
            placeholder={t('gapFill.step3.whyPlaceholder')}
            onChange={(event) => onChange(setWhy(exercise, gap.key, event.target.value))}
          />
          <p className="text-xs text-muted-foreground">{t('gapFill.step3.whyHelp')}</p>
        </div>

        {isBank && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium">{t('gapFill.step3.pairsTitle')}</p>
            {rows.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('gapFill.step3.pairsAllWritten')}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {rows.map((word) => {
                  const pair = feedback.pairs[word];
                  const text = pair?.origin === 'author' ? pair.text : '';
                  return (
                    <li key={word} className="flex items-center gap-2">
                      <span
                        className="w-28 shrink-0 truncate text-sm"
                        style={{ fontFamily: READING }}
                        id={`pair-${gap.key}-${word}`}
                      >
                        {word}
                      </span>
                      <Input
                        value={text}
                        disabled={disabled}
                        aria-labelledby={`pair-${gap.key}-${word}`}
                        // AC-B21: what the student would get instead, in the teacher's
                        // own words, so the choice to leave the cell empty is informed.
                        placeholder={
                          missingFallback
                            ? t('gapFill.step3.pairFallsBackEmpty')
                            : t('gapFill.step3.pairFallsBack', { fallback: feedback.fallback })
                        }
                        onChange={(event) =>
                          onChange(setPairText(exercise, gap.key, word, event.target.value))
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

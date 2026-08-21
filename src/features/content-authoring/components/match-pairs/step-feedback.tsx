'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, AlertTriangle } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { Input, Textarea } from '@/components/ui/input';
import { ProgressBar } from '@/components/ui/progress';
import { Segmented } from '@/components/ui/segmented';
import {
  completePairs,
  coverage,
  defaultExplanationLevel,
  feedbackFor,
  wrongItems,
  type MatchPairs,
  type Pair,
} from '@/lib/shared-kernel/match-pairs';

import { overrideText, pairCoverage, setDefault, setOverride, setWhy } from './edits';
import { MatchPairsMatrix } from './feedback-matrix';
import { SolvedPair } from './solved-pair';

const READING = 'var(--ssz-font-reading)';

type FeedbackView = 'list' | 'matrix';

export interface StepFeedbackProps {
  exercise: MatchPairs;
  onChange: (next: MatchPairs) => void;
  disabled?: boolean;
}

/**
 * Step 3 of the match-pairs builder: what the student is told when they attach the wrong
 * half — the step the whole design is built around.
 *
 * Feedback is authored per (pair × wrong half), and that grid grows fast: five pairs
 * against a pool of eight is thirty-five cells. So only the per-pair default is required,
 * and the cells are coverage the teacher fills in over time. Empty cells are legitimate,
 * and every one of them says what would be shown instead.
 *
 * Two views over the same data (BEHAVIOR §1.4), neither of them a mode: the list is where
 * one pair's feedback is written carefully, the matrix is where a run of cells is filled
 * in. Nothing is stored about which one was used last.
 */
export function StepFeedback({ exercise, onChange, disabled = false }: StepFeedbackProps) {
  const t = useTranslations('Authoring');
  const pairs = completePairs(exercise);
  const totals = coverage(exercise);
  /** `pairs` gets a reminder where `halves` gets a blocker — plan 49, decision 3. */
  const missingIsBlocker = defaultExplanationLevel(exercise.variant) === 'blocker';

  /** AC-B19: hides written cell rows only — never a pair's default field. */
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [view, setView] = useState<FeedbackView>('list');

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold">{t('matchPairs.step3.title')}</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          {t('matchPairs.step3.lede')}
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">
            {t('matchPairs.step3.coverage', { written: totals.written, total: totals.total })}
          </p>
          <div className="flex items-center gap-3">
            {view === 'list' && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={onlyMissing}
                  disabled={disabled}
                  onCheckedChange={(checked) => setOnlyMissing(checked === true)}
                />
                {t('matchPairs.step3.onlyMissing')}
              </label>
            )}
            <Segmented
              size="sm"
              options={[
                { value: 'list', label: t('matchPairs.step3.viewList') },
                { value: 'matrix', label: t('matchPairs.step3.viewMatrix') },
              ]}
              value={view}
              aria-label={t('matchPairs.step3.viewLabel')}
              onValueChange={(next) => setView(next as FeedbackView)}
            />
          </div>
        </div>

        <ProgressBar value={totals.pct} label={t('matchPairs.step3.coverageBar')} />

        {totals.noDefault > 0 &&
          (missingIsBlocker ? (
            <p role="alert" className="flex items-center gap-1.5 text-xs text-error">
              <AlertCircle className="size-3.5" aria-hidden />
              {t('matchPairs.step3.missingDefaults', { count: totals.noDefault })}
            </p>
          ) : (
            <p role="status" className="flex items-center gap-1.5 text-xs text-warning-700">
              <AlertTriangle className="size-3.5" aria-hidden />
              {t('matchPairs.step3.missingDefaultsWarn', { count: totals.noDefault })}
            </p>
          ))}
      </div>

      {pairs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('matchPairs.step3.empty')}</p>
      ) : view === 'matrix' ? (
        <MatchPairsMatrix exercise={exercise} onChange={onChange} disabled={disabled} />
      ) : (
        <ul className="flex flex-col gap-3">
          {pairs.map((pair, index) => (
            <li key={pair.id}>
              <PairCard
                exercise={exercise}
                pair={pair}
                index={index}
                onlyMissing={onlyMissing}
                missingIsBlocker={missingIsBlocker}
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

interface PairCardProps {
  exercise: MatchPairs;
  pair: Pair;
  index: number;
  onlyMissing: boolean;
  missingIsBlocker: boolean;
  disabled: boolean;
  onChange: (next: MatchPairs) => void;
}

/** One pair: the required default, the optional note on reveal, then every wrong half. */
function PairCard({
  exercise,
  pair,
  index,
  onlyMissing,
  missingIsBlocker,
  disabled,
  onChange,
}: PairCardProps) {
  const t = useTranslations('Authoring');
  const feedback = feedbackFor(exercise, pair.id);
  const own = pairCoverage(exercise, pair.id);
  const missingDefault = feedback.def.trim() === '';

  const rows = wrongItems(exercise, pair.id).filter(
    (item) => !onlyMissing || overrideText(exercise, pair.id, item.id).trim() === '',
  );

  const placeholder = missingDefault
    ? t('matchPairs.step3.fallsBackEmpty')
    : t('matchPairs.step3.fallsBack', { def: feedback.def });

  return (
    <div
      className={`rounded-lg border bg-surface ${
        missingDefault && missingIsBlocker ? 'border-error' : 'border-border'
      }`}
    >
      <div className="flex items-baseline gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-semibold">{index + 1}</span>
        <SolvedPair
          left={pair.left}
          right={pair.right}
          variant={exercise.variant}
          className="truncate"
        />
        <span className="flex-1" />
        <span className="shrink-0 text-xs text-muted-foreground">
          {t('matchPairs.step3.pairCoverage', { written: own.written, total: own.total })}
        </span>
      </div>

      <div className="flex flex-col gap-3 p-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" htmlFor={`mp-def-${pair.id}`}>
            {t('matchPairs.step3.defaultLabel')}
          </label>
          <Textarea
            id={`mp-def-${pair.id}`}
            rows={2}
            value={feedback.def}
            disabled={disabled}
            hasError={missingDefault && missingIsBlocker}
            aria-invalid={missingDefault && missingIsBlocker}
            placeholder={t('matchPairs.step3.defaultPlaceholder')}
            onChange={(event) => onChange(setDefault(exercise, pair.id, event.target.value))}
          />
          {missingDefault ? (
            <p
              role={missingIsBlocker ? 'alert' : 'status'}
              className={`flex items-center gap-1.5 text-xs ${
                missingIsBlocker ? 'text-error' : 'text-warning-700'
              }`}
            >
              <AlertCircle className="size-3.5" aria-hidden />
              {missingIsBlocker
                ? t('matchPairs.step3.defaultRequired')
                : t('matchPairs.step3.defaultSuggested')}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{t('matchPairs.step3.defaultHelp')}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" htmlFor={`mp-why-${pair.id}`}>
            {t('matchPairs.step3.whyLabel')}
          </label>
          <Textarea
            id={`mp-why-${pair.id}`}
            rows={2}
            value={feedback.why}
            disabled={disabled}
            placeholder={t('matchPairs.step3.whyPlaceholder')}
            onChange={(event) => onChange(setWhy(exercise, pair.id, event.target.value))}
          />
          <p className="text-xs text-muted-foreground">{t('matchPairs.step3.whyHelp')}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium">{t('matchPairs.step3.overridesTitle')}</p>
          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {onlyMissing
                ? t('matchPairs.step3.overridesAllWritten')
                : t('matchPairs.step3.overridesNone')}
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {rows.map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  <span
                    className="w-32 shrink-0 truncate text-sm"
                    style={{ fontFamily: exercise.variant === 'halves' ? READING : undefined }}
                    id={`mp-ov-${pair.id}-${item.id}`}
                    title={item.text}
                  >
                    {item.text}
                  </span>
                  <Input
                    value={overrideText(exercise, pair.id, item.id)}
                    disabled={disabled}
                    aria-labelledby={`mp-ov-${pair.id}-${item.id}`}
                    placeholder={placeholder}
                    onChange={(event) =>
                      onChange(setOverride(exercise, pair.id, item.id, event.target.value))
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

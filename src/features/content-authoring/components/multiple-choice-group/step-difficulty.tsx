'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, Info, LayoutGrid, Rows3 } from 'lucide-react';

import { Segmented } from '@/components/ui/segmented';

import { AudioRulesCard } from '../audio';
import {
  issues,
  passMark,
  readyRows,
  type Layout,
  type RetryPolicy,
} from '@/lib/shared-kernel/multiple-choice-group';

import { ToggleRow } from '../toggle-row';
import { setSettings, type MultipleChoiceGroupDocument } from './edits';
import { useIssueCopy } from './issue-copy';

/** README "Step 3": the pass mark is offered as five steps, not a free number. */
const THRESHOLDS = [50, 60, 70, 80, 100] as const;

export interface StepDifficultyProps {
  exercise: MultipleChoiceGroupDocument;
  onChange: (next: MultipleChoiceGroupDocument) => void;
}

/**
 * Step 3: the same table, with more or less help.
 *
 * Nothing here changes what is correct — only what happens after the one check the whole
 * table gets. That is the setting the type turns on: `retry` is a budget for the *table*,
 * not for a row, and `lockCorrect` decides whether a second pass is a correction of the
 * mistakes or a rewrite of the answers.
 *
 * Both contradictions the handoff names are reported here, beside the switches that cause
 * them, and not only in the gate. An author turning the key off on a one-shot table needs
 * to be told there that the student will never learn what was wrong; learning it from a
 * modal two clicks later is learning it too late.
 *
 * Neither is a blocker. A table nobody may retry and whose key is never shown is a
 * defensible choice on a placement test, and the handoff grades both as warnings.
 */
export function StepDifficulty({ exercise, onChange }: StepDifficultyProps) {
  const t = useTranslations('Authoring');
  const describeIssue = useIssueCopy(exercise);
  const s = exercise.settings;

  const notes = issues(exercise).filter((issue) => issue.step === 3);
  // Against the finished rows, because those are the ones a student is shown: a pass mark
  // read against four rows when two of them are half-written would be the wrong number in
  // exactly the case where the author most needs the right one.
  const total = Math.max(readyRows(exercise).length, 1);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('multipleChoiceGroup.step3.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('multipleChoiceGroup.step3.lede')}</p>
      </div>

      {exercise.audio.audio.enabled && (
        <AudioRulesCard
          draft={exercise.audio}
          onChange={(audio) => onChange({ ...exercise, audio })}
          itemNoun={t('multipleChoiceGroup.step3.audioItemNoun')}
        />
      )}

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">{t('multipleChoiceGroup.step3.retryLabel')}</span>
          <Segmented<RetryPolicy>
            value={s.retry}
            aria-label={t('multipleChoiceGroup.step3.retryLabel')}
            onValueChange={(retry) => onChange(setSettings(exercise, { retry }))}
            options={[
              { value: 'none', label: t('multipleChoiceGroup.step3.retryNone') },
              { value: 'one', label: t('multipleChoiceGroup.step3.retryOne') },
              { value: 'unlimited', label: t('multipleChoiceGroup.step3.retryUnlimited') },
            ]}
            className="self-start"
          />
          <p className="text-xs text-muted-foreground">
            {t('multipleChoiceGroup.step3.retryHelp')}
          </p>
        </div>

        <ToggleRow
          label={t('multipleChoiceGroup.step3.lockCorrectLabel')}
          help={t('multipleChoiceGroup.step3.lockCorrectHelp')}
          checked={s.lockCorrect}
          onChange={(lockCorrect) => onChange(setSettings(exercise, { lockCorrect }))}
        />
        <ToggleRow
          label={t('multipleChoiceGroup.step3.revealKeyLabel')}
          help={t('multipleChoiceGroup.step3.revealKeyHelp')}
          checked={s.revealKey}
          onChange={(revealKey) => onChange(setSettings(exercise, { revealKey }))}
        />
        <ToggleRow
          label={t('multipleChoiceGroup.step3.shuffleRowsLabel')}
          help={t('multipleChoiceGroup.step3.shuffleRowsHelp')}
          checked={s.shuffleRows}
          onChange={(shuffleRows) => onChange(setSettings(exercise, { shuffleRows }))}
        />
        <ToggleRow
          label={t('multipleChoiceGroup.step3.numberingLabel')}
          help={t('multipleChoiceGroup.step3.numberingHelp')}
          checked={s.numbering}
          onChange={(numbering) => onChange(setSettings(exercise, { numbering }))}
        />
        <ToggleRow
          label={t('multipleChoiceGroup.step3.showTextLabel')}
          help={t('multipleChoiceGroup.step3.showTextHelp')}
          checked={s.showText}
          onChange={(showText) => onChange(setSettings(exercise, { showText }))}
        />
        <ToggleRow
          label={t('multipleChoiceGroup.step3.progressLabel')}
          help={t('multipleChoiceGroup.step3.progressHelp')}
          checked={s.progress}
          onChange={(progress) => onChange(setSettings(exercise, { progress }))}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">{t('multipleChoiceGroup.step3.passLabel')}</span>
          <Segmented<string>
            value={String(s.passThreshold)}
            aria-label={t('multipleChoiceGroup.step3.passLabel')}
            onValueChange={(value) =>
              onChange(setSettings(exercise, { passThreshold: Number(value) }))
            }
            options={THRESHOLDS.map((threshold) => ({
              value: String(threshold),
              label: t(
                `multipleChoiceGroup.step3.pass${threshold}` as 'multipleChoiceGroup.step3.pass70',
              ),
            }))}
            className="self-start"
          />
          {/*
            The percent restated in rows, because that is the number an author can judge.
            "70%" of a five-row table is four rows right, and the difference between four
            and three is the whole decision.
          */}
          <p className="text-xs text-muted-foreground">
            {t('multipleChoiceGroup.step3.passHelp', {
              mark: passMark(s, total),
              total,
            })}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">{t('multipleChoiceGroup.step3.layoutLabel')}</span>
          <Segmented<Layout>
            value={s.layout}
            aria-label={t('multipleChoiceGroup.step3.layoutLabel')}
            onValueChange={(layout) => onChange(setSettings(exercise, { layout }))}
            options={[
              { value: 'auto', label: t('multipleChoiceGroup.step3.layoutTable'), icon: Rows3 },
              {
                value: 'cards',
                label: t('multipleChoiceGroup.step3.layoutCards'),
                icon: LayoutGrid,
              },
            ]}
            className="self-start"
          />
          <p className="text-xs text-muted-foreground">
            {t('multipleChoiceGroup.step3.layoutHelp')}
          </p>
        </div>
      </section>

      {notes.map((issue, at) => (
        <p
          key={`${issue.code}-${at}`}
          className={`flex items-start gap-1.5 text-xs ${
            issue.level === 'warning' ? 'text-warning-700' : 'text-muted-foreground'
          }`}
        >
          {issue.level === 'warning' ? (
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          ) : (
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          )}
          {describeIssue(issue)}
        </p>
      ))}
    </div>
  );
}

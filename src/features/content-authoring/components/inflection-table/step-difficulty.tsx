'use client';

import { Grid3x3, Pencil, Target, Type } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Segmented } from '@/components/ui/segmented';
import {
  ceilingCause,
  IT_MAX_ATTEMPTS,
  IT_MAX_BANK_EXTRA,
  IT_MIN_ATTEMPTS,
  IT_MIN_THRESHOLD,
  issues,
  type InflectionTableContent,
  type InputMode,
  type RevealKey,
} from '@/lib/shared-kernel/inflection-table';

import { Notes, type Note } from '../dictation/notes';
import { Callout, Card, Field, StepHead } from '../highlight-in-text/parts';
import { ToggleRow } from '../toggle-row';
import { setInput, setSettings } from './edits';
import { useIssueCopy } from './issue-copy';

export interface StepDifficultyProps<T extends InflectionTableContent> {
  exercise: T;
  onChange: (next: T) => void;
}

/**
 * Step 4: dials, kept away from content (plan 69 §7.5).
 *
 * Nothing here touches a row or a key — every control goes through `setInput` or
 * `setSettings`. The input mode decides what a success proves, so the line under it says so
 * (deviation 6: the evidence ceiling is said here, not in the gate), and the first-letter hint
 * says its own ceiling under its switch (decision Q3-A). The axes card is the shared one under
 * the builder and recomputes from the live document (IT-B11).
 */
export function StepDifficulty<T extends InflectionTableContent>({
  exercise,
  onChange,
}: StepDifficultyProps<T>) {
  const t = useTranslations('Authoring.inflectionTable.step4');
  const copy = useIssueCopy(exercise);
  const { input, settings } = exercise;
  const bank = input.mode === 'bank';

  const notes: Note[] = issues(exercise)
    .filter((issue) => issue.step === 4)
    .map((issue) => ({ key: issue.code, level: issue.level, text: copy.describe(issue) }));

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('eyebrow')} title={t('title')} lede={t('lede')} />

      <Card icon={Type} title={t('answerTitle')} labelledBy="it-answer-title">
        <Field
          label={t('inputLabel')}
          message={{
            tone: 'hint',
            text: bank ? t('inputHintBank') : t('inputHintType'),
            id: 'it-input-hint',
          }}
        >
          <Segmented<InputMode>
            aria-label={t('inputLabel')}
            size="sm"
            className="self-start"
            value={input.mode}
            onValueChange={(mode) => onChange(setInput(exercise, { mode }))}
            options={[
              { value: 'type', label: t('inputType'), icon: Pencil },
              { value: 'bank', label: t('inputBank'), icon: Grid3x3 },
            ]}
          />
        </Field>
        <p data-testid="it-ceiling" className="m-0 text-xs text-(--ssz-text-muted)">
          {bank ? t('ceilingBank') : t('ceilingNone')}
        </p>

        {bank && (
          <Field
            label={t('bankExtraLabel', { count: input.bankExtra })}
            htmlFor="it-bank-extra"
            message={{ tone: 'hint', text: t('bankExtraHint'), id: 'it-bank-extra-hint' }}
          >
            <input
              id="it-bank-extra"
              type="range"
              min={0}
              max={IT_MAX_BANK_EXTRA}
              step={1}
              value={input.bankExtra}
              aria-describedby="it-bank-extra-hint"
              onChange={(e) => onChange(setInput(exercise, { bankExtra: Number(e.target.value) }))}
            />
          </Field>
        )}
        <Notes notes={notes.filter((n) => n.key.startsWith('IT_BANK'))} />

        <ToggleRow
          label={t('shuffleLabel')}
          help={t('shuffleHelp')}
          checked={input.shuffleRows}
          onChange={(shuffleRows) => onChange(setInput(exercise, { shuffleRows }))}
        />
        <div className="flex flex-col gap-1.5">
          <ToggleRow
            label={t('hintLabel')}
            help={t('hintHelp')}
            checked={settings.hintFirstLetter}
            onChange={(hintFirstLetter) => onChange(setSettings(exercise, { hintFirstLetter }))}
          />
          {ceilingCause(exercise) === 'hint' && (
            <p data-testid="it-hint-ceiling" className="m-0 text-xs text-(--ssz-color-warning-700)">
              {t('ceilingHint')}
            </p>
          )}
        </div>
      </Card>

      <Card icon={Target} title={t('markingTitle')} labelledBy="it-marking-title">
        <Field
          label={t('attemptsLabel', { count: settings.attempts })}
          htmlFor="it-attempts"
          message={{ tone: 'hint', text: t('attemptsHelp'), id: 'it-attempts-hint' }}
        >
          <input
            id="it-attempts"
            type="range"
            min={IT_MIN_ATTEMPTS}
            max={IT_MAX_ATTEMPTS}
            step={1}
            value={settings.attempts}
            aria-describedby="it-attempts-hint"
            onChange={(e) => onChange(setSettings(exercise, { attempts: Number(e.target.value) }))}
          />
        </Field>
        <Field
          label={t('thresholdLabel', { threshold: settings.threshold })}
          htmlFor="it-threshold"
        >
          <input
            id="it-threshold"
            type="range"
            min={IT_MIN_THRESHOLD}
            max={100}
            step={5}
            value={settings.threshold}
            onChange={(e) => onChange(setSettings(exercise, { threshold: Number(e.target.value) }))}
          />
        </Field>
        <ToggleRow
          label={t('rowVerdictLabel')}
          help={t('rowVerdictHelp')}
          checked={settings.rowVerdict}
          onChange={(rowVerdict) => onChange(setSettings(exercise, { rowVerdict }))}
        />
        <Field label={t('revealLabel')}>
          <Segmented<RevealKey>
            aria-label={t('revealLabel')}
            size="sm"
            className="self-start"
            value={settings.revealKey}
            onValueChange={(revealKey) => onChange(setSettings(exercise, { revealKey }))}
            options={[
              { value: 'afterLast', label: t('revealAfterLast') },
              { value: 'afterFirst', label: t('revealAfterFirst') },
              { value: 'never', label: t('revealNever') },
            ]}
          />
        </Field>
        <Notes notes={notes.filter((n) => n.key === 'IT_KEY_NEVER_SHOWN')} />
      </Card>

      <Callout tone="tip">{t('tip')}</Callout>
    </div>
  );
}

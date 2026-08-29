'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, Grid2x2, Rows3 } from 'lucide-react';

import { Segmented } from '@/components/ui/segmented';
import { issues, type Layout, type RetryPolicy } from '@/lib/shared-kernel/multiple-choice';

import { ToggleRow } from '../toggle-row';
import { setSettings, type MultipleChoiceDocument } from './edits';
import { useIssueCopy } from './issue-copy';

export interface StepDifficultyProps {
  exercise: MultipleChoiceDocument;
  onChange: (next: MultipleChoiceDocument) => void;
}

/**
 * Step 3: the same questions, with more or less help.
 *
 * Nothing here changes what is correct — only how much of the answer the set gives away
 * and how many tries the student gets at it. The order is the handoff's: the switches that
 * shape the screen first, then the two that decide how much a mistake costs.
 *
 * Both contradictions are reported **here**, beside the switches that cause them, and not
 * only in the gate (plan 53 §7, phase 5). An author looking at "50/50 after a mistake"
 * needs to be told there that a one-shot question has no second attempt for it to precede;
 * learning it from a modal two clicks later is learning it too late.
 *
 * Neither is a blocker. `instant` with retries is a real choice an author is entitled to
 * make — a set where tapping through is the point — and the handoff grades both as
 * warnings (plan 53 §6.6).
 */
export function StepDifficulty({ exercise, onChange }: StepDifficultyProps) {
  const t = useTranslations('Authoring');
  const describeIssue = useIssueCopy(exercise);
  const s = exercise.settings;

  const contradictions = issues(exercise).filter((issue) => issue.step === 3);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('multipleChoice.step3.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('multipleChoice.step3.lede')}</p>
      </div>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <ToggleRow
          label={t('multipleChoice.step3.shuffleLabel')}
          help={t('multipleChoice.step3.shuffleHelp')}
          checked={s.shuffle}
          onChange={(shuffle) => onChange(setSettings(exercise, { shuffle }))}
        />
        <ToggleRow
          label={t('multipleChoice.step3.shuffleQuestionsLabel')}
          help={t('multipleChoice.step3.shuffleQuestionsHelp')}
          checked={s.shuffleQuestions}
          onChange={(shuffleQuestions) => onChange(setSettings(exercise, { shuffleQuestions }))}
        />
        <ToggleRow
          label={t('multipleChoice.step3.lettersLabel')}
          help={t('multipleChoice.step3.lettersHelp')}
          checked={s.letters}
          onChange={(letters) => onChange(setSettings(exercise, { letters }))}
        />
        <ToggleRow
          label={t('multipleChoice.step3.instantLabel')}
          help={t('multipleChoice.step3.instantHelp')}
          checked={s.instant}
          onChange={(instant) => onChange(setSettings(exercise, { instant }))}
        />
        <ToggleRow
          label={t('multipleChoice.step3.eliminateLabel')}
          help={t('multipleChoice.step3.eliminateHelp')}
          checked={s.eliminate}
          onChange={(eliminate) => onChange(setSettings(exercise, { eliminate }))}
        />
        <ToggleRow
          label={t('multipleChoice.step3.progressLabel')}
          help={t('multipleChoice.step3.progressHelp')}
          checked={s.progress}
          onChange={(progress) => onChange(setSettings(exercise, { progress }))}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">{t('multipleChoice.step3.retryLabel')}</span>
          <Segmented<RetryPolicy>
            value={s.retry}
            aria-label={t('multipleChoice.step3.retryLabel')}
            onValueChange={(retry) => onChange(setSettings(exercise, { retry }))}
            options={[
              { value: 'none', label: t('multipleChoice.step3.retryNone') },
              { value: 'one', label: t('multipleChoice.step3.retryOne') },
              { value: 'unlimited', label: t('multipleChoice.step3.retryUnlimited') },
            ]}
            className="self-start"
          />
          <p className="text-xs text-muted-foreground">{t('multipleChoice.step3.retryHelp')}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">{t('multipleChoice.step3.layoutLabel')}</span>
          <Segmented<Layout>
            value={s.layout}
            aria-label={t('multipleChoice.step3.layoutLabel')}
            onValueChange={(layout) => onChange(setSettings(exercise, { layout }))}
            options={[
              { value: 'list', label: t('multipleChoice.step3.layoutList'), icon: Rows3 },
              { value: 'grid', label: t('multipleChoice.step3.layoutGrid'), icon: Grid2x2 },
            ]}
            className="self-start"
          />
          <p className="text-xs text-muted-foreground">{t('multipleChoice.step3.layoutHelp')}</p>
        </div>
      </section>

      {contradictions.map((issue, at) => (
        <p
          key={`${issue.code}-${at}`}
          className="flex items-start gap-1.5 text-xs text-warning-700"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {describeIssue(issue)}
        </p>
      ))}
    </div>
  );
}

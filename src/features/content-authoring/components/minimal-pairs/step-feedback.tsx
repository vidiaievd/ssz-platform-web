'use client';

import { useTranslations } from 'next-intl';

import { Segmented } from '@/components/ui/segmented';
import { GLOSS_POLICIES, issues, SPELLING_POLICIES } from '@/lib/shared-kernel/minimal-pairs';

import { Notes } from '../dictation/notes';
import { Callout, Card, Field, StepHead } from '../highlight-in-text/parts';
import { ToggleRow } from '../toggle-row';
import { setFeedback, type DocumentUpdate, type MinimalPairsDocument } from './edits';
import { useIssueCopy } from './issue-copy';

export interface StepFeedbackProps {
  exercise: MinimalPairsDocument;
  onChange: DocumentUpdate;
}

/**
 * Step 4: what happens after the tap (plan 72 §7.5, MP-B21/B22).
 *
 * The correction is the exercise (DECISIONS §5), so the verdict and the A/B comparison are the
 * first two switches. What is shown on the buttons — spelling, meaning — decides how hard the
 * ear task is; the tip under them names the pairing most teachers land on.
 */
export function StepFeedback({ exercise, onChange }: StepFeedbackProps) {
  const t = useTranslations('Authoring.minimalPairs.step4');
  const copy = useIssueCopy(exercise);
  const f = exercise.feedback;

  const notes = issues(exercise)
    .filter((issue) => issue.step === 4)
    .map((issue, i) => ({
      key: `${issue.code}-${i}`,
      level: issue.level,
      text: copy.describe(issue),
    }));

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('eyebrow')} title={t('title')} lede={t('lede')} />

      <Card>
        <ToggleRow
          label={t('immediate.label')}
          help={t('immediate.help')}
          checked={f.immediate}
          onChange={(immediate) => onChange(setFeedback(exercise, { immediate }))}
        />
        <ToggleRow
          label={t('abCompare.label')}
          help={t('abCompare.help')}
          checked={f.abCompare}
          onChange={(abCompare) => onChange(setFeedback(exercise, { abCompare }))}
        />
        <ToggleRow
          label={t('secondChance.label')}
          help={t('secondChance.help')}
          checked={f.secondChance}
          onChange={(secondChance) => onChange(setFeedback(exercise, { secondChance }))}
        />
        <ToggleRow
          label={t('showIpa.label')}
          help={t('showIpa.help')}
          checked={f.showIpa}
          onChange={(showIpa) => onChange(setFeedback(exercise, { showIpa }))}
        />
      </Card>

      <Notes notes={notes} />

      <Card>
        <Field
          label={t('spelling.label')}
          message={{ tone: 'hint', text: t('spelling.hint'), id: 'mp-spelling-help' }}
        >
          <Segmented
            aria-label={t('spelling.label')}
            value={f.showSpelling}
            onValueChange={(showSpelling) => onChange(setFeedback(exercise, { showSpelling }))}
            options={SPELLING_POLICIES.map((value) => ({
              value,
              label: t(`spelling.${value}`),
            }))}
          />
        </Field>
        <Field
          label={t('gloss.label')}
          message={{ tone: 'hint', text: t('gloss.hint'), id: 'mp-gloss-help' }}
        >
          <Segmented
            aria-label={t('gloss.label')}
            value={f.showGloss}
            onValueChange={(showGloss) => onChange(setFeedback(exercise, { showGloss }))}
            options={GLOSS_POLICIES.map((value) => ({ value, label: t(`gloss.${value}`) }))}
          />
        </Field>
        <Callout tone="tip">{t('tip')}</Callout>
      </Card>
    </div>
  );
}

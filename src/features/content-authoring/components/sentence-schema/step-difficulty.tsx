'use client';

import { useTranslations } from 'next-intl';
import { Lightbulb } from 'lucide-react';

import { issues } from '@/lib/shared-kernel/sentence-schema';

import { ToggleRow } from '../toggle-row';
import { useIssueCopy } from './issue-copy';
import { setSettings, type SentenceSchemaDocument } from './edits';

export interface StepDifficultyProps {
  exercise: SentenceSchemaDocument;
  onChange: (next: SentenceSchemaDocument) => void;
}

/**
 * Step 3: nine switches over one answer key.
 *
 * Nothing here changes what is correct — only how much of the answer the board gives away
 * before the student starts. That is the whole idea of the step, and it is why the order
 * is the handoff's and not alphabetical or grouped: it reads from the strongest support to
 * the strictest marking, so running down the list is running the same exercise from
 * "first time seeing a schema" to "prove it".
 *
 * `settings.markEmpty` is not here. The handoff declares it and leaves it unbuilt, and
 * plan 52 Q6 keeps it that way: it lives in the model so building it later needs no
 * migration, and a switch for a behaviour the runner does not have would be a lie in the
 * one place authors go to decide how hard the exercise is.
 */
export function StepDifficulty({ exercise, onChange }: StepDifficultyProps) {
  const t = useTranslations('Authoring');
  const describeIssue = useIssueCopy(exercise);
  const s = exercise.settings;

  const extrasWithoutAny = issues(exercise).find((issue) => issue.code === 'EXTRAS_ON_BUT_NONE');
  /*
    Five of the nine switches are about fields, and sequence-only has none — so in that
    mode they are not drawn at all.
    
    This reverses an earlier decision to draw them inert (plan 52, Q8). The worry then was
    sound — a switch that disappears takes its setting's existence with it — but it was
    written when the mode was one toggle among nine on this very screen, where five
    neighbours vanishing had no visible cause. The mode is now a card at the top of step 1,
    so the cause is on screen; and the worry is answered directly instead: the values are
    untouched in the document, and the line left in place of the section says they are
    coming back.
  */
  const seq = s.orderOnly;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('sentenceSchema.step3.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('sentenceSchema.step3.lede')}</p>
      </div>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        {!seq && (
          <ToggleRow
            label={t('sentenceSchema.step3.labelsLabel')}
            help={t('sentenceSchema.step3.labelsHelp')}
            checked={s.labels}
            onChange={(labels) => onChange(setSettings(exercise, { labels }))}
          />
        )}
        {!seq && (
          <ToggleRow
            label={t('sentenceSchema.step3.hintsLabel')}
            help={t('sentenceSchema.step3.hintsHelp')}
            checked={s.hints}
            onChange={(hints) => onChange(setSettings(exercise, { hints }))}
          />
        )}
        {!seq && (
          <ToggleRow
            label={t('sentenceSchema.step3.countsLabel')}
            help={t('sentenceSchema.step3.countsHelp')}
            checked={s.counts}
            onChange={(counts) => onChange(setSettings(exercise, { counts }))}
          />
        )}
        <ToggleRow
          label={t('sentenceSchema.step3.prefillLabel')}
          help={t('sentenceSchema.step3.prefillHelp')}
          checked={s.prefill === 'first'}
          onChange={(on) => onChange(setSettings(exercise, { prefill: on ? 'first' : 'none' }))}
        />
        <ToggleRow
          label={t('sentenceSchema.step3.extrasLabel')}
          help={t('sentenceSchema.step3.extrasHelp')}
          checked={s.extras}
          onChange={(extras) => onChange(setSettings(exercise, { extras }))}
        />
        <ToggleRow
          label={t('sentenceSchema.step3.shuffleLabel')}
          help={t('sentenceSchema.step3.shuffleHelp')}
          checked={s.shuffle}
          onChange={(shuffle) => onChange(setSettings(exercise, { shuffle }))}
        />
        {!seq && (
          <ToggleRow
            label={t('sentenceSchema.step3.perFieldLabel')}
            help={t('sentenceSchema.step3.perFieldHelp')}
            checked={s.perField}
            onChange={(perField) => onChange(setSettings(exercise, { perField }))}
          />
        )}
        <ToggleRow
          label={t('sentenceSchema.step3.hintAfterMistakeLabel')}
          help={t('sentenceSchema.step3.hintAfterMistakeHelp')}
          checked={s.hintAfterMistake}
          onChange={(hintAfterMistake) => onChange(setSettings(exercise, { hintAfterMistake }))}
        />
        {!seq && (
          <ToggleRow
            label={t('sentenceSchema.step3.orderLabel')}
            help={t('sentenceSchema.step3.orderHelp')}
            // Sequence-only grades order and nothing else, so `loose` would be an off
            // switch for the exercise rather than a difficulty setting.
            checked={s.order === 'strict'}
            onChange={(on) => onChange(setSettings(exercise, { order: on ? 'strict' : 'loose' }))}
          />
        )}

        {seq && (
          <p className="text-xs text-muted-foreground">{t('sentenceSchema.step3.fieldsHidden')}</p>
        )}
      </section>

      {/* Beside the switch that causes it: the gate is too late to learn this about a
          setting you are looking at. */}
      {extrasWithoutAny !== undefined && (
        <p className="text-xs text-warning-700">{describeIssue(extrasWithoutAny)}</p>
      )}

      <p className="flex items-start gap-2 rounded-lg border border-border bg-subtle p-3 text-xs text-muted-foreground">
        <Lightbulb className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {t('sentenceSchema.step3.tip')}
      </p>
    </div>
  );
}

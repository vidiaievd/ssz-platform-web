'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Grid3x3, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import {
  findWord,
  issues,
  lcg,
  MAX_PROBES,
  MIN_PROBES,
  OPTIONS_MODES,
  PLAYS_PER_PROBE,
  PROBES_INPUT_MAX,
  PROBES_INPUT_MIN,
  PROBES_METER_MAX,
  probePool,
  SAMPLINGS,
  sample,
  type PlaysPerProbe,
} from '@/lib/shared-kernel/minimal-pairs';

import { Notes } from '../dictation/notes';
import { Callout, Card, EmptyState, Field, StepHead } from '../highlight-in-text/parts';
import { ToggleRow } from '../toggle-row';
import { setProbes, setSet, type DocumentUpdate, type MinimalPairsDocument } from './edits';
import { useIssueCopy } from './issue-copy';
import { MeterRow, MONO, NumberField, READING } from './parts';

export interface StepProbesProps {
  exercise: MinimalPairsDocument;
  onChange: DocumentUpdate;
}

/**
 * Step 3: how many probes, how they are drawn and what the student may do with each (plan 72
 * §7.4, MP-B17…B20).
 *
 * «One draw» is the kernel's own sampler on the prototype's generator, so it shows what a student
 * could be dealt; the order a student really gets is drawn by the engine, per attempt, and never
 * sits in a page. Every limit is the kernel's: the field's 2–30, the band of 8–15 as advice.
 */
export function StepProbes({ exercise, onChange }: StepProbesProps) {
  const t = useTranslations('Authoring.minimalPairs.step3');
  const copy = useIssueCopy(exercise);
  const s = exercise.set;
  const pool = probePool(exercise);
  const [seed, setSeed] = useState(7);
  const draw = useMemo(() => sample(exercise, lcg(seed)), [exercise, seed]);

  const notes = issues(exercise)
    .filter((issue) => issue.step === 3)
    .map((issue, i) => ({
      key: `${issue.code}-${i}`,
      level: issue.level,
      text: copy.describe(issue),
    }));

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('eyebrow')} title={t('title')} lede={t('lede')} />

      <MeterRow
        figure={s.probes}
        unit={t('probesUnit')}
        sub={t('fromWords', { count: pool })}
        value={(s.probes / PROBES_METER_MAX) * 100}
        band={{
          from: (MIN_PROBES / PROBES_METER_MAX) * 100,
          to: (MAX_PROBES / PROBES_METER_MAX) * 100,
        }}
        barLabel={t('probesMeter')}
        barSub={t('band', { min: MIN_PROBES, max: MAX_PROBES })}
      >
        <NumberField
          label={t('probesField')}
          min={PROBES_INPUT_MIN}
          max={PROBES_INPUT_MAX}
          value={s.probes}
          onCommit={(probes) => onChange(setProbes(exercise, probes))}
        />
      </MeterRow>

      <Notes notes={notes} />

      <Card>
        <Field
          label={t('sampling.label')}
          message={{
            tone: 'hint',
            text: t('sampling.hint', { run: s.maxSameAnswer }),
            id: 'mp-sampling-help',
          }}
        >
          <Segmented
            aria-label={t('sampling.label')}
            value={s.sampling}
            onValueChange={(sampling) => onChange(setSet(exercise, { sampling }))}
            options={SAMPLINGS.map((value) => ({ value, label: t(`sampling.${value}`) }))}
          />
        </Field>
        {s.sampling === 'weakest' && (
          <Callout tone="tip">
            {t.rich('weakestTip', {
              id: exercise.contrastId === '' ? '…' : exercise.contrastId,
              mono: (chunk) => <span style={MONO}>{chunk}</span>,
            })}
          </Callout>
        )}

        <Field
          label={t('options.label')}
          message={{ tone: 'hint', text: t('options.hint'), id: 'mp-options-help' }}
        >
          <Segmented
            aria-label={t('options.label')}
            value={s.options}
            onValueChange={(options) => onChange(setSet(exercise, { options }))}
            options={OPTIONS_MODES.map((value) => ({ value, label: t(`options.${value}`) }))}
          />
        </Field>

        <Field
          label={t('plays.label')}
          message={{ tone: 'hint', text: t('plays.hint'), id: 'mp-plays-help' }}
        >
          <Segmented
            aria-label={t('plays.label')}
            // Segmented speaks strings; the document holds 0–3, with 0 for «unlimited».
            value={String(s.playsPerProbe)}
            onValueChange={(value) =>
              onChange(setSet(exercise, { playsPerProbe: Number(value) as PlaysPerProbe }))
            }
            options={PLAYS_PER_PROBE.map((value) => ({
              value: String(value),
              label: value === 0 ? t('plays.unlimited') : String(value),
            }))}
          />
        </Field>

        <div className="flex flex-col gap-3">
          <ToggleRow
            label={t('autoplay.label')}
            help={t('autoplay.help')}
            checked={s.autoplay}
            onChange={(autoplay) => onChange(setSet(exercise, { autoplay }))}
          />
          <ToggleRow
            label={t('repeat.label')}
            help={t('repeat.help', { count: pool })}
            checked={s.allowRepeat}
            onChange={(allowRepeat) => onChange(setSet(exercise, { allowRepeat }))}
          />
          <ToggleRow
            label={t('shuffle.label')}
            help={t('shuffle.help')}
            checked={s.shuffleOptions}
            onChange={(shuffleOptions) => onChange(setSet(exercise, { shuffleOptions }))}
          />
        </div>
      </Card>

      <Card
        icon={Grid3x3}
        title={t('draw.title')}
        note={
          <Button type="button" variant="ghost" size="sm" onClick={() => setSeed((n) => n + 1)}>
            <RefreshCw className="size-3.5" aria-hidden />
            {t('draw.again')}
          </Button>
        }
      >
        {draw.length === 0 ? (
          <EmptyState icon={Grid3x3} title={t('draw.emptyTitle')} body={t('draw.emptyBody')} />
        ) : (
          <ol className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label={t('draw.title')}>
            {draw.map((probe) => (
              <li
                key={probe.n}
                data-side={probe.side}
                className={`inline-flex items-center gap-1.5 rounded-full border py-[5px] pr-2.5 pl-[5px] text-sm ${
                  probe.side === 0
                    ? 'border-(--ssz-color-primary-200) bg-(--ssz-color-primary-50)'
                    : 'border-(--ssz-border-default) bg-(--ssz-bg-subtle)'
                }`}
                style={READING}
              >
                <i
                  className="grid size-[18px] place-items-center rounded-full bg-(--ssz-bg-surface) text-[10px] text-(--ssz-text-muted) not-italic"
                  style={MONO}
                >
                  {probe.n}
                </i>
                {findWord(exercise, probe.wordId)?.text ?? '—'}
              </li>
            ))}
          </ol>
        )}
        <p className="m-0 text-xs text-(--ssz-text-muted)">{t('draw.note')}</p>
      </Card>
    </div>
  );
}

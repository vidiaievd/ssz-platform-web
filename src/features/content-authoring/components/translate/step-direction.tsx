'use client';

import { useTranslations } from 'next-intl';
import { ArrowLeftRight, ArrowRight, Info, Lightbulb, List, Repeat, Rows3 } from 'lucide-react';

import { Input, Textarea } from '@/components/ui/input';
import {
  authoredItems,
  templateCode,
  type Direction,
  type Format,
  type Translate,
} from '@/lib/shared-kernel/translate';

import { setDirection, swapLangs } from './edits';

const DIRECTIONS: readonly Direction[] = ['to_target', 'from_target', 'both'];

const FORMATS: { value: Format; icon: typeof List }[] = [
  { value: 'single', icon: Rows3 },
  { value: 'set', icon: List },
];

export interface StepDirectionProps {
  exercise: Translate;
  onChange: (next: Translate) => void;
}

/**
 * Step 1 of the translate builder: which way the sentences are translated, between which
 * languages, and the two lines of framing the student reads first.
 *
 * The direction is the one setting on this screen that changes what everything else means:
 * it decides which language the sentence is read in, which language the answer key has to
 * be written in, and — via `templateCode` — which catalogue entry the exercise files
 * under. So it is three cards with the stored code printed under each, which is what the
 * handoff asks for and what course authors asked for (BEHAVIOR.md, "Шаг 1 — Retning").
 *
 * There is no title field, although the prototype has one: the platform has no title on an
 * exercise, instructions carry that job, and the other two builders drop it for the same
 * reason.
 */
export function StepDirection({ exercise, onChange }: StepDirectionProps) {
  const t = useTranslations('Authoring');
  const written = authoredItems(exercise);
  const { explain, target } = exercise.langs;

  /** What the student reads, and what they write, for the flow diagram. */
  const reads = exercise.dir === 'from_target' ? target : explain;
  const writes = exercise.dir === 'from_target' ? explain : target;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('translate.step1.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('translate.step1.lede')}</p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-medium">{t('translate.step1.dirLabel')}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {DIRECTIONS.map((value) => {
            const isActive = exercise.dir === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={isActive}
                onClick={() => onChange(setDirection(exercise, value))}
                className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ${
                  isActive
                    ? 'border-primary bg-primary-50'
                    : 'border-border hover:bg-[var(--ssz-bg-subtle)]'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  {value === 'both' ? (
                    <Repeat className="size-4" aria-hidden />
                  ) : (
                    <ArrowRight className="size-4" aria-hidden />
                  )}
                  {t(`translate.step1.dir.${value}` as 'translate.step1.dir.both', {
                    explain,
                    target,
                  })}
                </span>
                {/* The stored template code, printed because authors work with it: it is
                    what the catalogue, the review queue and the SRS weights key off. */}
                <code className="text-[11px] text-muted-foreground">{templateCode(value)}</code>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-40 flex-1 flex-col gap-1">
          <label className="text-xs font-medium" htmlFor="tr-lang-explain">
            {t('translate.step1.explainLabel')}
          </label>
          <Input
            id="tr-lang-explain"
            value={explain}
            onChange={(event) =>
              onChange({ ...exercise, langs: { ...exercise.langs, explain: event.target.value } })
            }
          />
        </div>

        <button
          type="button"
          onClick={() => onChange(swapLangs(exercise))}
          aria-label={t('translate.step1.swap')}
          title={t('translate.step1.swap')}
          className="mb-1 flex size-9 items-center justify-center rounded-md border border-border hover:bg-[var(--ssz-bg-subtle)]"
        >
          <ArrowLeftRight className="size-4" aria-hidden />
        </button>

        <div className="flex min-w-40 flex-1 flex-col gap-1">
          <label className="text-xs font-medium" htmlFor="tr-lang-target">
            {t('translate.step1.targetLabel')}
          </label>
          <Input
            id="tr-lang-target"
            value={target}
            onChange={(event) =>
              onChange({ ...exercise, langs: { ...exercise.langs, target: event.target.value } })
            }
          />
        </div>
      </div>

      {/*
        What the setting above actually does, spelled out in the author's own language
        names — including the half authors get wrong: with `from_target` the answer key is
        written in the language of explanation, not in the language being learnt.
      */}
      <p className="flex items-start gap-2 rounded-md border border-border bg-[var(--ssz-bg-subtle)] px-4 py-3 text-sm text-[var(--ssz-text-secondary)]">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <span className="block font-medium">
            {exercise.dir === 'both'
              ? t('translate.step1.flowBoth', { explain, target })
              : t('translate.step1.flow', { reads, writes })}
          </span>
          <span className="block text-xs">
            {exercise.dir === 'both'
              ? t('translate.step1.flowBothHelp')
              : t('translate.step1.flowHelp', { writes })}
          </span>
        </span>
      </p>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-medium">{t('translate.step1.formatLabel')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {FORMATS.map(({ value, icon: Icon }) => {
            const isActive = exercise.format === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={isActive}
                onClick={() => onChange({ ...exercise, format: value })}
                className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ${
                  isActive
                    ? 'border-primary bg-primary-50'
                    : 'border-border hover:bg-[var(--ssz-bg-subtle)]'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="size-4" aria-hidden />
                  {t(`translate.step1.format.${value}` as 'translate.step1.format.set')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t(`translate.step1.formatHelp.${value}` as 'translate.step1.formatHelp.set')}
                </span>
              </button>
            );
          })}
        </div>
        {/* Nothing is thrown away when the format narrows: the extra sentences hold their
            answer keys, and the kernel reports them as a warning instead. */}
        {exercise.format === 'single' && written.length > 1 && (
          <p className="text-xs text-warning-700" role="status">
            {t('translate.step1.singleManyItems', { count: written.length })}
          </p>
        )}
      </fieldset>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" htmlFor="tr-instructions">
          {t('translate.step1.instructionsLabel')}
        </label>
        <Input
          id="tr-instructions"
          value={exercise.instructions}
          hasError={exercise.instructions.trim() === ''}
          aria-invalid={exercise.instructions.trim() === ''}
          placeholder={t('translate.step1.instructionsPlaceholder')}
          onChange={(event) => onChange({ ...exercise, instructions: event.target.value })}
        />
        <p className="text-xs text-muted-foreground">{t('translate.step1.instructionsHelp')}</p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" htmlFor="tr-note">
          {t('translate.step1.noteLabel')}
        </label>
        <Textarea
          id="tr-note"
          rows={2}
          value={exercise.note}
          placeholder={t('translate.step1.notePlaceholder')}
          onChange={(event) => onChange({ ...exercise, note: event.target.value })}
        />
        <p className="text-xs text-muted-foreground">{t('translate.step1.noteHelp')}</p>
      </div>

      <p className="flex items-start gap-2 rounded-md border border-border bg-[var(--ssz-bg-subtle)] px-4 py-3 text-sm text-[var(--ssz-text-secondary)]">
        <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t('translate.step1.tip')}
      </p>
    </div>
  );
}

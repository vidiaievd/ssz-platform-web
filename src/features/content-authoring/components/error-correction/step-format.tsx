'use client';

import { useTranslations } from 'next-intl';
import { AlignLeft, Info, List, Lightbulb } from 'lucide-react';

import { Input, Textarea } from '@/components/ui/input';
import {
  authoredItems,
  type ErrorCorrection,
  type Mode,
} from '@/lib/shared-kernel/error-correction';

const MODES: { value: Mode; icon: typeof List }[] = [
  { value: 'sentences', icon: List },
  { value: 'passage', icon: AlignLeft },
];

export interface StepFormatProps {
  exercise: ErrorCorrection;
  onChange: (next: ErrorCorrection) => void;
}

/**
 * Step 1 of the error-correction builder: what kind of correction this is, and the one
 * line the student reads first.
 *
 * Controlled and presentational — a document in, a document out. There is no title field
 * here although the handoff's prototype has one: the platform has no title on an
 * exercise, instructions carry that job, and the gap-fill builder drops its `EX_NO_TITLE`
 * for the same reason.
 *
 * Switching to `passage` keeps every item. The kernel reports the extra ones as
 * `PASSAGE_MANY_ITEMS`, a warning rather than a silent truncation, because the items
 * hold the answer key and this screen is not the place to throw that away.
 */
export function StepFormat({ exercise, onChange }: StepFormatProps) {
  const t = useTranslations('Authoring');
  const written = authoredItems(exercise);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('errorCorrection.step1.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('errorCorrection.step1.lede')}</p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-medium">{t('errorCorrection.step1.modeLabel')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {MODES.map(({ value, icon: Icon }) => {
            const isActive = exercise.mode === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={isActive}
                onClick={() => onChange({ ...exercise, mode: value })}
                className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ${
                  isActive
                    ? 'border-primary bg-primary-50'
                    : 'border-border hover:bg-[var(--ssz-bg-subtle)]'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="size-4" aria-hidden />
                  {t(`errorCorrection.step1.mode.${value}` as 'errorCorrection.step1.mode.passage')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t(
                    `errorCorrection.step1.modeHelp.${value}` as 'errorCorrection.step1.modeHelp.passage',
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {exercise.mode === 'passage'
            ? t('errorCorrection.step1.passageNote')
            : t('errorCorrection.step1.sentencesNote')}
        </p>
        {exercise.mode === 'passage' && written.length > 1 && (
          <p className="text-xs text-warning-700" role="status">
            {t('errorCorrection.step1.passageManyItems', { count: written.length })}
          </p>
        )}
      </fieldset>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" htmlFor="ec-instructions">
          {t('errorCorrection.step1.instructionsLabel')}
        </label>
        <Input
          id="ec-instructions"
          value={exercise.instructions}
          hasError={exercise.instructions.trim() === ''}
          aria-invalid={exercise.instructions.trim() === ''}
          placeholder={t('errorCorrection.step1.instructionsPlaceholder')}
          onChange={(event) => onChange({ ...exercise, instructions: event.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          {t('errorCorrection.step1.instructionsHelp')}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" htmlFor="ec-note">
          {t('errorCorrection.step1.noteLabel')}
        </label>
        <Textarea
          id="ec-note"
          rows={2}
          value={exercise.note}
          placeholder={t('errorCorrection.step1.notePlaceholder')}
          onChange={(event) => onChange({ ...exercise, note: event.target.value })}
        />
        <p className="text-xs text-muted-foreground">{t('errorCorrection.step1.noteHelp')}</p>
      </div>

      <p className="flex items-start gap-2 rounded-md border border-border bg-[var(--ssz-bg-subtle)] px-4 py-3 text-sm text-[var(--ssz-text-secondary)]">
        <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t('errorCorrection.step1.tip')}
      </p>
    </div>
  );
}

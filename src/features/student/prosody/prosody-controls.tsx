'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import { PROSODY_LENSES, type ProsodyLens } from './prosody-text';
import type { ProsodyMode, ProsodySettings } from './prosody-settings';

const MODES: readonly ProsodyMode[] = ['meaning', 'sentences', 'text'];

export interface ProsodyControlsProps {
  settings: ProsodySettings;
  onChange: (settings: ProsodySettings) => void;
  /** The layer is being fetched after the mode left «Meaning». */
  loading?: boolean;
  /** «Melody» is offered only where someone marked the phrase (a text nobody marked has no melody). */
  melody?: boolean;
  className?: string;
}

function choice(on: boolean) {
  return cn(
    'rounded-(--ssz-radius-sm) border px-2.5 py-1 text-xs font-semibold',
    'focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus) focus-visible:outline-none',
    on
      ? 'border-(--ssz-color-primary-500) bg-(--ssz-color-primary-50) text-(--ssz-color-primary-700)'
      : 'border-(--ssz-border-default) text-(--ssz-text-secondary)',
  );
}

/**
 * How the pronunciation is read (plan 86, §4i.2, Q-i7): «Meaning» · «By sentence» · «Whole text»,
 * and — outside «Meaning» — exactly one lens at a time, because the sum of the lenses is not
 * readable. The legend switch sits last. Off («Meaning») by default; nothing is fetched until
 * the mode leaves it.
 */
export function ProsodyControls({
  settings,
  onChange,
  loading = false,
  melody = true,
  className,
}: ProsodyControlsProps) {
  const t = useTranslations('ExerciseRunner.prosody');
  const lenses = PROSODY_LENSES.filter((l) => l !== 'melody' || melody || settings.lens === 'melody');
  // Explicit branches, not `t(`mode_${mode}`)`: a template key makes tsc run out of memory on these messages.
  const modeLabel: Record<ProsodyMode, string> = {
    meaning: t('modeMeaning'),
    sentences: t('modeSentences'),
    text: t('modeText'),
  };
  const lensLabel: Record<ProsodyLens, string> = {
    stress: t('lensStress'),
    sounds: t('lensSounds'),
    respell: t('lensRespell'),
    melody: t('lensMelody'),
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div role="radiogroup" aria-label={t('group')} className="flex flex-wrap items-center gap-1.5">
        {MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={settings.mode === mode}
            className={choice(settings.mode === mode)}
            onClick={() => onChange({ ...settings, mode })}
          >
            {modeLabel[mode]}
          </button>
        ))}
        {loading && (
          <span role="status" className="text-xs text-(--ssz-text-muted)">
            {t('loading')}
          </span>
        )}
      </div>
      {settings.mode !== 'meaning' && (
        <>
          <div
            role="radiogroup"
            aria-label={t('lensGroup')}
            className="flex flex-wrap items-center gap-1.5"
          >
            {lenses.map((lens) => (
              <button
                key={lens}
                type="button"
                role="radio"
                aria-checked={settings.lens === lens}
                className={choice(settings.lens === lens)}
                onClick={() => onChange({ ...settings, lens })}
              >
                {lensLabel[lens]}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-(--ssz-text-secondary)">
            <input
              type="checkbox"
              checked={settings.legend}
              onChange={(e) => onChange({ ...settings, legend: e.target.checked })}
            />
            {t('legendShow')}
          </label>
        </>
      )}
    </div>
  );
}

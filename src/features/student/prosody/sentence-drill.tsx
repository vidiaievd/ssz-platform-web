'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

import { ProsodyLegend } from './prosody-legend';
import type { ProsodySettings } from './prosody-settings';
import { ProsodyText } from './prosody-text';
import type { SentenceRecording } from './sentence-recording';
import { SentenceTake } from './sentence-take';
import { drillSentences, type DrillUnit } from './sentence-view';

export interface SentenceDrillProps {
  units: readonly DrillUnit[];
  settings: ProsodySettings;
  lang?: string;
  /** The attempt's way to hear a take of the sentence; absent — the drill only shows. */
  recording?: SentenceRecording;
  className?: string;
}

/**
 * Pronunciation by sentence (plan 86, §4i.2): one sentence large with the chosen lens, the
 * legend of that lens under it, and the list of all sentences to move between. A sentence is
 * the right unit — one thing in front of the eyes, short enough to say again. With a `recording` (step 6g) the learner
 * says the sentence and hears a model's reading of it, outside the exercise's own checks.
 */
export function SentenceDrill({ units, settings, lang, recording, className }: SentenceDrillProps) {
  const t = useTranslations('ExerciseRunner.prosody');
  const sentences = useMemo(() => drillSentences(units), [units]);
  const [picked, setAt] = useState(0);
  // A shorter list after the text changed must not leave the card on a sentence that is gone.
  const at = picked < sentences.length ? picked : 0;

  const current = sentences[at];
  if (current === undefined) return null;

  return (
    <section
      aria-label={t('drillTitle')}
      data-drill=""
      className={cn(
        'flex flex-col gap-3 rounded-(--ssz-radius-md) border border-(--ssz-border-default) bg-(--ssz-bg-subtle) p-4',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 text-xs text-(--ssz-text-muted)">
        <span role="status">{t('drillCounter', { n: at + 1, total: sentences.length })}</span>
        <span className="flex gap-1.5">
          <button
            type="button"
            disabled={at === 0}
            onClick={() => setAt(at - 1)}
            className="rounded-(--ssz-radius-sm) border border-(--ssz-border-default) px-2 py-0.5 disabled:opacity-40"
          >
            {t('drillPrev')}
          </button>
          <button
            type="button"
            disabled={at >= sentences.length - 1}
            onClick={() => setAt(at + 1)}
            className="rounded-(--ssz-radius-sm) border border-(--ssz-border-default) px-2 py-0.5 disabled:opacity-40"
          >
            {t('drillNext')}
          </button>
        </span>
      </div>

      <ProsodyText
        key={current.key}
        text={current.text}
        layer={current.layer}
        sounds={current.sounds}
        view={{ lens: settings.lens }}
        lang={lang}
        className="text-2xl"
      />

      {settings.legend && <ProsodyLegend lens={settings.lens} />}

      {recording !== undefined && (
        <SentenceTake
          key={current.key}
          itemId={current.unitKey}
          sentence={current.text}
          recording={recording}
        />
      )}

      {sentences.length > 1 && (
        <ol aria-label={t('drillList')} className="flex flex-col gap-0.5 border-t border-(--ssz-border-default) pt-2">
          {sentences.map((sentence, k) => (
            <li key={sentence.key}>
              <button
                type="button"
                aria-current={k === at ? 'true' : undefined}
                onClick={() => setAt(k)}
                className={cn(
                  'w-full truncate rounded-(--ssz-radius-sm) px-2 py-1 text-left text-sm',
                  k === at
                    ? 'bg-(--ssz-color-primary-50) font-semibold text-(--ssz-color-primary-700)'
                    : 'text-(--ssz-text-secondary) hover:bg-(--ssz-bg-hover)',
                )}
              >
                {sentence.text}
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

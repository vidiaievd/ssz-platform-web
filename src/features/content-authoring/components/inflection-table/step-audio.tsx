'use client';

import { useTranslations } from 'next-intl';

import type { AudioDraft } from '@/lib/shared-kernel/audio';

import { AudioEnableRow, AudioRulesCard, AudioSourceCard } from '../audio';
import { Callout, Card, StepHead } from '../highlight-in-text/parts';

export interface StepAudioProps {
  audio: AudioDraft;
  onAudioChange: (next: AudioDraft) => void;
}

/**
 * Step 5: audio, optional and attached the usual way (plan 69 §7.6).
 *
 * The shared layer's cards and nothing of this type's own: one clip over the whole table, so
 * no per-cell timecodes (`segments={false}`) and no transcript card — a paradigm read aloud
 * has nothing to hide (deviation 7). Off by default (IT-B12).
 */
export function StepAudio({ audio, onAudioChange }: StepAudioProps) {
  const t = useTranslations('Authoring.inflectionTable');
  const on = audio.audio.enabled;

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('step5.eyebrow')} title={t('step5.title')} lede={t('step5.lede')} />

      <Card>
        <AudioEnableRow draft={audio} onChange={onAudioChange} />
        {!on && <p className="m-0 text-xs text-(--ssz-text-muted)">{t('step5.audioOff')}</p>}
      </Card>

      {on && (
        <>
          <AudioSourceCard draft={audio} onChange={onAudioChange} />
          <AudioRulesCard
            draft={audio}
            onChange={onAudioChange}
            itemNoun={t('audioItemNoun')}
            segments={false}
          />
          <Callout tone="info">
            {t.rich('step5.audioInfo', {
              code: (chunks) => <code className="font-mono text-xs">{chunks}</code>,
            })}
          </Callout>
        </>
      )}
    </div>
  );
}

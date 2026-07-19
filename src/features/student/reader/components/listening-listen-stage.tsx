'use client';

import { Headphones } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { AudioPlayer } from '@/features/learning';

export interface ListeningListenStageProps {
  audioSrc?: string;
  audioLabel: string;
  onNext: () => void;
}

/** Stage 1 — audio-first, no transcript shown (BEHAVIOR.md §7). */
export function ListeningListenStage({ audioSrc, audioLabel, onNext }: ListeningListenStageProps) {
  const t = useTranslations('Learning.reader.listening.listen');

  return (
    <div>
      <div className="flex flex-col items-center gap-3.5 px-0 pb-7.5 pt-5 text-center">
        <div
          className="flex h-19 w-19 items-center justify-center rounded-full border-2"
          style={{
            background: 'var(--ssz-color-primary-50)',
            borderColor: 'var(--ssz-color-primary-100)',
          }}
        >
          <Headphones size={34} style={{ color: 'var(--ssz-color-primary-500)' }} aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-reading mb-1.5 text-2xl font-semibold text-(--ssz-text-primary)">
            {t('heading')}
          </h2>
          <p className="mx-auto max-w-100 text-sm leading-relaxed text-(--ssz-text-secondary)">{t('body')}</p>
        </div>
      </div>
      <AudioPlayer src={audioSrc} label={audioLabel} />
      <div className="mt-7 flex justify-center">
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-xl bg-(--ssz-color-primary-500) px-7 py-3 text-[15px] font-bold text-white transition-colors hover:bg-(--ssz-color-primary-600) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
          style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
        >
          {t('cta')}
        </button>
      </div>
    </div>
  );
}

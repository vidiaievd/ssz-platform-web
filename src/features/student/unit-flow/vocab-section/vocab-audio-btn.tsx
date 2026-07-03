'use client';

import { useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

export function VocabAudioBtn({ src, small = false }: { src?: string; small?: boolean }) {
  const t = useTranslations('Learning.vocabSection');
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  function handlePlay(e: React.MouseEvent) {
    e.stopPropagation();
    const el = audioRef.current;
    if (!el || !src) return;
    void el.play().then(() => setPlaying(true)).catch(() => null);
    el.onended = () => setPlaying(false);
  }

  return (
    <>
      {src && <audio ref={audioRef} src={src} preload="none" />}
      <button
        type="button"
        onClick={handlePlay}
        disabled={!src}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border font-medium transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
          'disabled:pointer-events-none disabled:opacity-40',
          small ? 'px-2.5 py-1 text-[12px]' : 'px-4 py-1.5 text-[13px]',
          playing
            ? 'border-(--ssz-color-primary-500)/40 bg-(--ssz-color-primary-500)/8 text-(--ssz-color-primary-500)'
            : 'border-(--ssz-border-default) bg-surface text-(--ssz-text-secondary) hover:border-(--ssz-color-primary-500)/60',
        )}
        style={{ fontFamily: 'var(--ssz-font-ui)', transitionDuration: 'var(--ssz-duration-fast)' }}
        aria-label={playing ? t('playing') : t('listen')}
      >
        <Volume2 size={small ? 12 : 14} aria-hidden="true" />
        {playing ? t('playing') : t('listen')}
      </button>
    </>
  );
}

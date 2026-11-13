'use client';

import { Volume2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import type { ReferenceClip } from '../types';

/** The model's reading of each word of the step, one button per clip. */
export function ClipButtons({ clips }: { clips: readonly ReferenceClip[] }) {
  const t = useTranslations('Pronunciation.step');
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(
    () => () => {
      audio.current?.pause();
      audio.current = null;
    },
    [],
  );

  if (clips.length === 0) return <p className="text-sm text-(--ssz-text-muted)">{t('noClip')}</p>;

  function play(clip: ReferenceClip) {
    audio.current?.pause();
    const el = new Audio(clip.url);
    audio.current = el;
    setPlaying(clip.word);
    const done = () => setPlaying((p) => (p === clip.word ? null : p));
    el.addEventListener('ended', done);
    el.addEventListener('error', done);
    void el.play().catch(done);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {clips.map((clip) => (
        <button
          key={clip.word}
          type="button"
          onClick={() => play(clip)}
          aria-label={`${t('listen')}: ${clip.word}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-(--ssz-border-strong) px-3 py-1.5 text-sm font-medium text-(--ssz-text-primary) hover:bg-(--ssz-bg-hover)"
        >
          <Volume2 aria-hidden className="h-4 w-4" />
          {playing === clip.word ? t('playing') : clip.word}
        </button>
      ))}
    </div>
  );
}

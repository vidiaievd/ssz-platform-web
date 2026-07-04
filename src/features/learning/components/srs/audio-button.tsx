'use client';

import { Volume2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AudioButtonProps {
  src: string;
  className?: string;
}

/**
 * Play/replay button for a single audio asset.
 * Self-removes if the asset fails to load or decode — never shows a broken control.
 */
export function AudioButton({ src, className }: AudioButtonProps) {
  const t = useTranslations('Srs.card');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playable, setPlayable] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    const onEnded = () => setPlaying(false);
    const onError = () => setPlayable(false);

    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.pause();
    };
  }, [src]);

  if (!playable) return null;

  const handlePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.currentTime = 0;
    }
    void audio.play().catch(() => setPlayable(false));
    setPlaying(true);
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handlePlay}
      aria-label={t('playAudio')}
      className={cn('rounded-full', className)}
    >
      <Volume2 className="h-4 w-4" aria-hidden />
    </Button>
  );
}

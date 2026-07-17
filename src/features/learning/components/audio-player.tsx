'use client';

import { Pause, Play, RotateCcw, RotateCw, Volume2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';

import { cn } from '@/lib/utils';

import { useMediaPlayer } from '../hooks/use-media-player';

export interface AudioPlayerProps {
  src?: string;
  label?: string;
  /** false = shell (renders UI but no actual audio; for SSR or missing src) */
  interactive?: boolean;
  compact?: boolean;
  className?: string;
}

export function AudioPlayer({
  src,
  label,
  interactive = true,
  compact = false,
  className,
}: AudioPlayerProps) {
  const t = useTranslations('Learning.audio');
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasAudio = interactive && !!src;
  const { playing, duration, current, speed, loading, error, togglePlay, seek, scrubTo, cycleSpeed } =
    useMediaPlayer(audioRef, hasAudio, { persistKey: hasAudio ? src : undefined });

  function onScrub(e: React.ChangeEvent<HTMLInputElement>) {
    scrubTo(parseFloat(e.target.value));
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  if (error) return null;

  if (compact) {
    return (
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? t('pause') : t('play')}
        disabled={!hasAudio || loading}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5',
          'border-(--ssz-border-default) bg-surface',
          'text-xs font-medium text-(--ssz-text-secondary)',
          'hover:border-(--ssz-color-primary-500) hover:text-(--ssz-color-primary-600)',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
          'disabled:pointer-events-none disabled:opacity-40',
          'transition-colors',
          className,
        )}
        style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
      >
        {hasAudio && src && <audio ref={audioRef} src={src} preload="metadata" />}
        {playing ? <Pause size={13} aria-hidden="true" /> : <Volume2 size={13} aria-hidden="true" />}
        {loading ? t('loading') : playing ? t('pause') : (label ?? t('play'))}
      </button>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border p-3',
        'border-(--ssz-border-default) bg-surface',
        className,
      )}
      role="region"
      aria-label={label ?? t('player')}
    >
      {hasAudio && src && <audio ref={audioRef} src={src} preload="metadata" />}

      {/* scrub bar */}
      <div className="flex items-center gap-2">
        <span className="w-8 shrink-0 text-right text-2xs tabular-nums text-(--ssz-text-muted)">
          {fmt(current)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={current}
          onChange={onScrub}
          disabled={!hasAudio || loading}
          aria-label={t('scrub')}
          className="h-1.5 w-full cursor-pointer accent-(--ssz-color-primary-500) disabled:opacity-40"
        />
        <span className="w-8 shrink-0 text-2xs tabular-nums text-(--ssz-text-muted)">
          {fmt(duration)}
        </span>
      </div>

      {/* controls */}
      <div className="flex items-center justify-between gap-2">
        {/* seek back */}
        <button
          type="button"
          onClick={() => seek(-10)}
          disabled={!hasAudio || loading}
          aria-label={t('seekBack')}
          className="flex h-8 w-8 items-center justify-center rounded-full text-(--ssz-text-secondary) hover:text-(--ssz-text-primary) disabled:opacity-40"
        >
          <RotateCcw size={15} aria-hidden="true" />
        </button>

        {/* play/pause */}
        <button
          type="button"
          onClick={togglePlay}
          disabled={!hasAudio || loading}
          aria-label={playing ? t('pause') : t('play')}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full',
            'bg-(--ssz-color-primary-500) text-white',
            'hover:bg-(--ssz-color-primary-600)',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
            'disabled:opacity-40 disabled:pointer-events-none',
            'transition-colors',
          )}
          style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
        >
          {playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
        </button>

        {/* seek forward */}
        <button
          type="button"
          onClick={() => seek(10)}
          disabled={!hasAudio || loading}
          aria-label={t('seekForward')}
          className="flex h-8 w-8 items-center justify-center rounded-full text-(--ssz-text-secondary) hover:text-(--ssz-text-primary) disabled:opacity-40"
        >
          <RotateCw size={15} aria-hidden="true" />
        </button>

        {/* speed */}
        <button
          type="button"
          onClick={cycleSpeed}
          disabled={!hasAudio}
          aria-label={t('speed', { speed })}
          className={cn(
            'rounded-md border px-2 py-0.5 text-xs font-semibold tabular-nums',
            'border-(--ssz-border-default) text-(--ssz-text-secondary)',
            'hover:border-(--ssz-color-primary-500) hover:text-(--ssz-color-primary-600)',
            'disabled:opacity-40 disabled:pointer-events-none',
            'transition-colors',
          )}
          style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
        >
          {speed}×
        </button>
      </div>
    </div>
  );
}

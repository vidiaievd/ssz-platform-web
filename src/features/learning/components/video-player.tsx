'use client';

import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Pause, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { LessonVideoCue } from '@/features/content/types';
import { cn } from '@/lib/utils';

import { GlossaryParagraph } from './glossary-paragraph';
import { useMediaPlayer } from '../hooks/use-media-player';
import { formatTimecode } from '../lib/format-timecode';
import type { GlossaryIndex } from '../lib/tokenize-glossary';

export interface VideoPlayerHandle {
  /** Seeks to `seconds` and resumes playback — used by the transcript's click-to-seek. */
  seekTo: (seconds: number) => void;
}

export interface VideoPlayerProps {
  src?: string;
  label: string;
  cues: LessonVideoCue[];
  glossary: GlossaryIndex;
  targetLang: string;
  showSubtitles: boolean;
  onTimeUpdate?: (seconds: number) => void;
  className?: string;
}

/** Finds the last cue whose startSeconds has passed, i.e. the one currently playing. */
function findActiveCue(cues: LessonVideoCue[], currentTime: number): LessonVideoCue | null {
  let active: LessonVideoCue | null = null;
  for (const cue of cues) {
    if (cue.startSeconds <= currentTime && (!active || cue.startSeconds > active.startSeconds)) {
      active = cue;
    }
  }
  return active;
}

/**
 * Real `<video>` element with custom controls and a live interactive-subtitle
 * overlay. Shares its play/pause/seek/speed-cycle/position-persistence engine
 * with `AudioPlayer` via `useMediaPlayer` (FE6.1's "one AudioBar").
 */
export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(function VideoPlayer(
  { src, label, cues, glossary, targetLang, showSubtitles, onTimeUpdate, className },
  ref,
) {
  const t = useTranslations('Learning.reader.video.player');
  const videoRef = useRef<HTMLVideoElement>(null);
  const { playing, duration, current, speed, togglePlay, scrubTo, cycleSpeed } = useMediaPlayer(
    videoRef,
    !!src,
    { persistKey: src, onTimeUpdate },
  );

  useImperativeHandle(ref, () => ({
    seekTo(seconds: number) {
      const el = videoRef.current;
      if (!el) return;
      scrubTo(seconds);
      void el.play().catch(() => {});
    },
  }));

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    scrubTo(Number(e.target.value));
  }

  const activeCue = showSubtitles ? findActiveCue(cues, current) : null;

  return (
    <div
      aria-label={label}
      className={cn('overflow-hidden rounded-[18px] bg-black shadow-(--ssz-shadow-lg)', className)}
    >
      <div className="relative aspect-video">
        {src ? (
          <video ref={videoRef} src={src} className="h-full w-full" onClick={togglePlay}>
            <track kind="captions" />
          </video>
        ) : (
          <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-white/60">
            {t('noSource')}
          </div>
        )}
        {!playing && src && (
          <button
            type="button"
            onClick={togglePlay}
            aria-label={t('play')}
            className="absolute top-1/2 left-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
          >
            <Play size={22} className="ml-0.5 text-black" aria-hidden="true" />
          </button>
        )}
        {activeCue && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-6">
            <div className="pointer-events-auto max-w-[90%] rounded-md bg-black/70 px-3.5 py-2 backdrop-blur-sm">
              <GlossaryParagraph
                text={activeCue.targetLine}
                glossary={glossary}
                lang={targetLang}
                className="text-center text-[17px] leading-normal text-white"
              />
            </div>
          </div>
        )}
      </div>
      <div className="bg-[#1a1815] px-3.5 pt-2.5 pb-3">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(current, duration || 0)}
          onChange={handleSeek}
          aria-label={t('scrubber')}
          disabled={!src}
          className="mb-2.5 w-full accent-(--ssz-color-primary-500)"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!src}
            aria-label={playing ? t('pause') : t('play', { label })}
            className="flex text-white disabled:opacity-40"
          >
            {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          </button>
          <span className="font-mono text-[11.5px] text-white/70">
            {formatTimecode(current)} / {formatTimecode(duration)}
          </span>
          <button
            type="button"
            onClick={cycleSpeed}
            disabled={!src}
            aria-label={t('speed', { speed })}
            className="ml-auto rounded-md border border-white/25 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white/85 transition-colors hover:border-white/50 disabled:opacity-40 disabled:pointer-events-none"
          >
            {speed}×
          </button>
        </div>
      </div>
    </div>
  );
});

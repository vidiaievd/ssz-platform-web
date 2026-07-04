'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Headphones } from 'lucide-react';

import { cn } from '@/lib/utils';

const SPEED_CYCLE = [0.75, 1, 1.25, 1.5] as const;
type Speed = (typeof SPEED_CYCLE)[number];

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m)}:${sec.toString().padStart(2, '0')}`;
}

export interface ReadAudioPlayerProps {
  src?: string;
  trackTitle?: string;
  trackSubtitle?: string;
  /** Compact = no track header. */
  compact?: boolean;
  /** Called with currentTime on every timeupdate (for paragraph sync). */
  onTimeUpdate?: (t: number) => void;
  /** Called when audio ends or pos > 85% of duration. */
  onProgress?: (finished: boolean) => void;
  className?: string;
}

export function ReadAudioPlayer({
  src,
  trackTitle,
  trackSubtitle,
  compact = false,
  onTimeUpdate,
  onProgress,
  className,
}: ReadAudioPlayerProps) {
  const t = useTranslations('Learning.audio');
  const audioRef  = useRef<HTMLAudioElement>(null);
  const trackRef  = useRef<HTMLDivElement>(null);
  const [playing,  setPlaying]  = useState(false);
  const [pos,      setPos]      = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed,    setSpeed]    = useState<Speed>(1);
  const [scrubbing, setScrubbing] = useState(false);

  const hasAudio = !!src;
  const pct = duration > 0 ? Math.min((pos / duration) * 100, 100) : 0;

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onReady = () => setDuration(el.duration || 0);
    const onTime  = () => {
      const cur = el.currentTime;
      setPos(cur);
      onTimeUpdate?.(cur);
      if (el.duration > 0 && cur > el.duration * 0.85) onProgress?.(true);
    };
    const onEnd  = () => { setPlaying(false); onProgress?.(true); };
    el.addEventListener('loadedmetadata', onReady);
    el.addEventListener('canplaythrough', onReady);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnd);
    return () => {
      el.removeEventListener('loadedmetadata', onReady);
      el.removeEventListener('canplaythrough', onReady);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnd);
    };
  }, [onTimeUpdate, onProgress]);

  function togglePlay() {
    const el = audioRef.current;
    if (!el || !hasAudio) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play().then(() => setPlaying(true)).catch(() => null);
    }
  }

  function replay() {
    const el = audioRef.current;
    if (!el || !hasAudio) return;
    el.currentTime = Math.max(0, el.currentTime - 10);
  }

  function cycleSpeed() {
    const el = audioRef.current;
    const next = SPEED_CYCLE[(SPEED_CYCLE.indexOf(speed) + 1) % SPEED_CYCLE.length] ?? 1;
    setSpeed(next);
    if (el) el.playbackRate = next;
  }

  const seek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = audioRef.current;
      const tr = trackRef.current;
      if (!el || !tr || !hasAudio || duration === 0) return;
      const rect = tr.getBoundingClientRect();
      const frac = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
      el.currentTime = frac * duration;
      setPos(frac * duration);
    },
    [hasAudio, duration],
  );

  /* expose play(from) for external paragraph-seek */
  function seekTo(seconds: number) {
    const el = audioRef.current;
    if (!el || !hasAudio) return;
    el.currentTime = seconds;
    setPos(seconds);
    if (!playing) {
      void el.play().then(() => setPlaying(true)).catch(() => null);
    }
  }

  return (
    <div
      className={cn(
        'rounded-2xl border',
        'border-(--ssz-border-default) bg-surface',
        className,
      )}
      style={{
        boxShadow: 'var(--ssz-shadow-md)',
        padding: compact ? '12px 16px' : '16px 18px',
      }}
      role="region"
      aria-label={t('player')}
    >
      {src && <audio ref={audioRef} src={src} preload="metadata" />}

      {/* Track header (non-compact / listen modes) */}
      {!compact && (
        <div className="mb-3 flex items-center gap-2">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'oklch(0.62 0.105 168 / 14%)' }}
            aria-hidden="true"
          >
            <Headphones size={16} style={{ color: 'var(--ssz-color-primary-500)' }} />
          </div>
          <div className="min-w-0">
            {trackTitle && (
              <p className="truncate font-reading text-[13px] font-semibold text-(--ssz-text-primary)">
                {trackTitle}
              </p>
            )}
            {trackSubtitle && (
              <p className="truncate text-[11px] text-(--ssz-text-muted)">{trackSubtitle}</p>
            )}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2.5">
        {/* ← 10s */}
        <button
          type="button"
          onClick={replay}
          disabled={!hasAudio}
          aria-label={t('seekBack')}
          className="flex shrink-0 items-center justify-center rounded-lg p-1 text-(--ssz-text-secondary) transition-colors hover:text-(--ssz-color-primary-500) disabled:opacity-40"
          style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M2.5 7.5v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4.34 14.5A8.5 8.5 0 1 0 5.9 5.5L2.5 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            <text x="12" y="15.5" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="currentColor" fontFamily="var(--ssz-font-ui)">10</text>
          </svg>
        </button>

        {/* Play / Pause */}
        <button
          type="button"
          onClick={togglePlay}
          disabled={!hasAudio}
          aria-label={playing ? t('pause') : t('play')}
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            'bg-(--ssz-color-primary-500) text-white',
            'hover:bg-(--ssz-color-primary-700)',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
            'disabled:pointer-events-none disabled:opacity-40',
            'transition-colors',
          )}
          style={{
            transitionDuration: 'var(--ssz-duration-fast)',
            boxShadow: 'oklch(0.62 0.105 168 / 27%) 0 2px 10px',
          }}
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6" y="4" width="4" height="16" rx="1" fill="white"/>
              <rect x="14" y="4" width="4" height="16" rx="1" fill="white"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <polygon points="6,3 20,12 6,21" fill="white"/>
            </svg>
          )}
        </button>

        {/* Scrub bar + time */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* Track */}
          <div
            ref={trackRef}
            role="slider"
            aria-label={t('scrub')}
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(pos)}
            onClick={seek}
            onMouseDown={(e) => { setScrubbing(true); seek(e); }}
            onMouseUp={() => setScrubbing(false)}
            onMouseLeave={() => setScrubbing(false)}
            className={cn('relative h-1 rounded-full', hasAudio ? 'cursor-pointer' : 'cursor-default')}
            style={{ background: 'var(--ssz-bg-muted)' }}
          >
            {/* Buffered (fake, pos+15%) */}
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${Math.min(pct + 15, 100)}%`,
                background: 'var(--ssz-border-default)',
              }}
              aria-hidden="true"
            />
            {/* Played */}
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${pct}%`,
                background: 'var(--ssz-color-primary-500)',
                transition: scrubbing ? 'none' : 'width 120ms linear',
              }}
              aria-hidden="true"
            >
              {/* Thumb */}
              <div
                className="absolute -right-1.5 -top-1 h-3 w-3 rounded-full"
                style={{
                  background: 'var(--ssz-color-primary-500)',
                  border: '2px solid var(--ssz-bg-surface)',
                  boxShadow: '0 0 0 2px oklch(0.62 0.105 168 / 40%)',
                  opacity: playing || scrubbing ? 1 : 0.6,
                  transition: 'opacity 200ms',
                }}
                aria-hidden="true"
              />
            </div>
          </div>

          {/* Time */}
          <div
            className="flex justify-between text-[10.5px] text-(--ssz-text-muted)"
            style={{ fontFamily: 'var(--ssz-font-mono)' }}
            aria-hidden="true"
          >
            <span>{fmt(pos)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>

        {/* Speed */}
        <button
          type="button"
          onClick={cycleSpeed}
          disabled={!hasAudio}
          aria-label={`${String(speed)}× speed`}
          className={cn(
            'shrink-0 min-w-11.5 rounded-lg border px-2.5 py-1 text-center text-xs font-bold tabular-nums',
            'transition-all disabled:opacity-40',
            speed !== 1
              ? 'border-(--ssz-color-primary-500)/40 bg-(--ssz-color-primary-500)/12 text-(--ssz-color-primary-700)'
              : 'border-(--ssz-border-default) bg-subtle text-(--ssz-text-secondary)',
          )}
          style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
        >
          {speed}×
        </button>
      </div>

    </div>
  );
}

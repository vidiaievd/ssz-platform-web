'use client';

import { useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Pause, Play } from 'lucide-react';

import { Segmented } from '@/components/ui/segmented';
import { bucketPeaks } from '@/features/student/exercises/recorder/port';
import { formatSeconds } from '@/lib/shared-kernel/read-aloud';

/** `TakePlayer` of the prototype at full width: 56 bars (`raPeaks(…, 56)`). */
const BARS = 56;
/** One arrow key moves this far — far enough to re-hear a word, short enough to find it. */
const STEP_SECONDS = 5;
const SPEEDS = ['0.75', '1', '1.25'] as const;
type Speed = (typeof SPEEDS)[number];

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)';

export interface ReviewTakePlayerProps {
  /** A signed link; null when there is nothing to play — the player is drawn, and inert. */
  src: string | null;
  /** 0..1 from media-service; null until processing has drawn them — a flat bar meanwhile. */
  peaks: readonly number[] | null;
  /** Server-measured when known, the client's report otherwise. */
  seconds: number;
  label: string;
}

/**
 * The teacher's player — the student's `TakePlayer` with the two things a grader needs and a
 * learner does not (README «Playback», plan 70 §4.2 item 12): a scrub bar, to go back to the
 * word that was swallowed, and speed, to hear it slower.
 *
 * The waveform is the scrub bar. It is a slider to assistive technology and to the keyboard
 * (arrows ±5 s, Home/End), and a click on it moves there. Progress is measured against the
 * length the server measured: a stream's own `duration` may be unknown until it has loaded.
 */
export function ReviewTakePlayer({ src, peaks, seconds, label }: ReviewTakePlayerProps) {
  const t = useTranslations('Review.readAloud.player');
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [speed, setSpeed] = useState<Speed>('1');

  const bars =
    peaks === null || peaks.length === 0
      ? new Array<number>(BARS).fill(0.18)
      : bucketPeaks(peaks, BARS);
  const total = seconds > 0 ? seconds : 0;
  const pos = total > 0 ? Math.min(1, at / total) : 0;
  const playable = src !== null;

  function toggle() {
    const el = audio.current;
    if (el === null) return;
    if (el.paused) void el.play().catch(() => setPlaying(false));
    else el.pause();
  }

  function seek(toSeconds: number) {
    const next = Math.min(Math.max(0, toSeconds), total);
    const el = audio.current;
    if (el !== null) el.currentTime = next;
    setAt(next);
  }

  function onBarClick(event: MouseEvent<HTMLDivElement>) {
    if (!playable || total === 0) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width <= 0) return;
    seek(((event.clientX - box.left) / box.width) * total);
  }

  function onBarKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!playable) return;
    const moves: Record<string, number> = {
      ArrowLeft: at - STEP_SECONDS,
      ArrowDown: at - STEP_SECONDS,
      ArrowRight: at + STEP_SECONDS,
      ArrowUp: at + STEP_SECONDS,
      Home: 0,
      End: total,
    };
    const to = moves[event.key];
    if (to === undefined) return;
    event.preventDefault();
    seek(to);
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex items-center gap-2.5 rounded-(--ssz-radius-md) border bg-(--ssz-bg-surface)"
        style={{ padding: '9px 11px', borderColor: 'var(--ssz-border-default)' }}
      >
        {src !== null && (
          <audio
            ref={audio}
            src={src}
            preload="metadata"
            onPlay={(e) => {
              e.currentTarget.playbackRate = Number(speed);
              setPlaying(true);
            }}
            onPause={() => setPlaying(false)}
            onEnded={() => {
              setPlaying(false);
              setAt(0);
            }}
            onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
          />
        )}
        <button
          type="button"
          onClick={toggle}
          disabled={!playable}
          aria-label={playing ? t('pause') : t('play', { label })}
          aria-pressed={playing}
          className={`grid size-[34px] shrink-0 place-items-center rounded-full border disabled:opacity-50 ${FOCUS_RING}`}
          style={
            playing
              ? {
                  background: 'var(--ssz-color-primary-500)',
                  borderColor: 'var(--ssz-color-primary-500)',
                  color: '#fff',
                }
              : {
                  background: 'var(--ssz-bg-surface)',
                  borderColor: 'var(--ssz-border-strong)',
                  color: 'var(--ssz-text-primary)',
                }
          }
        >
          {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
        </button>
        <div
          role="slider"
          tabIndex={playable ? 0 : -1}
          aria-label={t('seek', { label })}
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(at)}
          aria-valuetext={t('position', { at: formatSeconds(at), total: formatSeconds(total) })}
          aria-disabled={!playable}
          onClick={onBarClick}
          onKeyDown={onBarKey}
          className={`flex h-7 min-w-0 flex-1 items-center gap-0.5 rounded-sm ${playable ? 'cursor-pointer' : ''} ${FOCUS_RING}`}
        >
          {bars.map((h, i) => (
            <i
              key={i}
              aria-hidden="true"
              className="block min-w-[2px] flex-1 rounded-[1px]"
              style={{
                height: Math.max(2, Math.round(h * 26)),
                background:
                  pos > 0 && (i + 1) / bars.length <= pos
                    ? 'var(--ssz-color-primary-500)'
                    : 'var(--ssz-border-strong)',
              }}
            />
          ))}
        </div>
        <span
          className="shrink-0 text-[11px] tabular-nums text-(--ssz-text-muted)"
          style={{ fontFamily: 'var(--ssz-font-mono)' }}
        >
          {formatSeconds(total)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11.5px] text-(--ssz-text-muted)">{t('speed')}</span>
        <Segmented<string>
          size="sm"
          aria-label={t('speed')}
          value={speed}
          onValueChange={(value) => {
            const next = SPEEDS.find((s) => s === value) ?? '1';
            setSpeed(next);
            if (audio.current !== null) audio.current.playbackRate = Number(next);
          }}
          options={SPEEDS.map((value) => ({ value, label: `${value}×` }))}
        />
      </div>
    </div>
  );
}

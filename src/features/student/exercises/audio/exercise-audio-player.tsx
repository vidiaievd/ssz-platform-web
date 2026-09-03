'use client';

import { Gauge, Pause, Play, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { formatDuration } from '@/lib/shared-kernel/audio';

import type { ExerciseAudioEngine } from './use-exercise-audio';

export interface ExerciseAudioPlayerProps {
  eng: ExerciseAudioEngine;
  /** `quiet` sits above the items; `big` fills the listen-first screen. */
  tone?: 'quiet' | 'big';
  /** False in a preview: everything renders, nothing responds. */
  interactive?: boolean;
}

/**
 * The player of a listening exercise — BEHAVIOR.md §5, and not the lesson player.
 *
 * What makes it a different instrument from `Learning/AudioPlayer` is the allowance: a
 * press here may be refused, and the pips say how many listens are left before it is. It
 * decides none of that itself — `useExerciseAudio` holds the kernel's state machine and
 * this draws it.
 *
 * Two accessibility rules the handoff marks as unclosed in the prototype are closed here
 * (plan 56 §3.12): the progress bar is a real slider and answers to the arrow keys, and
 * the play state is always in text, never in the animation alone. The bars are decoration
 * and say `aria-hidden`; `motion-reduce` stops them moving.
 */
export function ExerciseAudioPlayer({
  eng,
  tone = 'quiet',
  interactive = true,
}: ExerciseAudioPlayerProps) {
  const t = useTranslations('ExerciseRunner');
  const live = interactive && !eng.failed;
  const { settings } = eng.audio;
  const big = tone === 'big';

  const status = eng.failed
    ? t('audio.status.failed')
    : eng.playing
      ? t('audio.status.playing')
      : eng.exhausted && !eng.canPlay
        ? t('audio.status.spent')
        : eng.state.pos > 0
          ? t('audio.status.paused')
          : t('audio.status.idle');

  const percent = eng.duration > 0 ? Math.min(100, (eng.state.pos / eng.duration) * 100) : 0;
  const band =
    eng.state.range !== null && eng.duration > 0
      ? {
          left: (eng.state.range.start / eng.duration) * 100,
          width: ((eng.state.range.end - eng.state.range.start) / eng.duration) * 100,
        }
      : null;

  return (
    <div
      className={`flex flex-col gap-2 rounded-xl px-3.5 py-3 ${big ? 'gap-3' : ''}`}
      style={{
        border: '1.5px solid var(--ssz-border-default)',
        background: 'var(--ssz-bg-subtle)',
        // The whole player dims when there is nothing left to start (BEHAVIOR §5).
        opacity: eng.exhausted && !eng.playing ? 0.6 : 1,
      }}
    >
      {eng.element}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={eng.toggle}
          disabled={!live || !eng.canPlay}
          aria-label={eng.playing ? t('audio.pause') : t('audio.play')}
          className="grid flex-none place-items-center rounded-full text-white transition-transform disabled:cursor-default disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
          style={{
            // 44 is the tap-target floor; the gate screen's is the handoff's 72.
            width: big ? 72 : 44,
            height: big ? 72 : 44,
            background: 'var(--ssz-color-primary-600)',
          }}
        >
          {eng.playing ? (
            <Pause size={big ? 28 : 18} aria-hidden="true" />
          ) : (
            <Play size={big ? 28 : 18} aria-hidden="true" className="translate-x-px" />
          )}
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {eng.audio.title.trim() !== '' && (
            <p className="truncate text-[13px] font-semibold text-(--ssz-text-primary)">
              {eng.audio.title}
            </p>
          )}

          <Track
            eng={eng}
            live={live}
            percent={percent}
            band={band}
            label={t('audio.position')}
          />

          <div className="flex items-center gap-2 text-[11.5px] text-(--ssz-text-muted)">
            <span className="tabular-nums">
              {formatDuration(eng.state.pos)} / {formatDuration(eng.duration)}
            </span>
            {/* The status is text, always. The bars alone would say it only to people who
                can see them move. */}
            <span role="status" className="truncate">
              {status}
            </span>
            <Bars playing={eng.playing} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {settings.seek && (
          <button
            type="button"
            onClick={eng.back}
            disabled={!live}
            className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold text-(--ssz-text-secondary) disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
            style={{ borderColor: 'var(--ssz-border-default)' }}
          >
            <RotateCcw size={12} aria-hidden="true" />
            {t('audio.back10')}
          </button>
        )}

        {settings.speed && (
          <button
            type="button"
            onClick={eng.cycleSpeed}
            disabled={!live}
            aria-label={t('audio.speedLabel')}
            className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold tabular-nums text-(--ssz-text-secondary) disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
            style={{ borderColor: 'var(--ssz-border-default)' }}
          >
            <Gauge size={12} aria-hidden="true" />
            {t('audio.speed', { rate: eng.speed })}
          </button>
        )}

        {eng.limit > 0 && <Plays spent={eng.plays} limit={eng.limit} />}
      </div>
    </div>
  );
}

/**
 * The progress bar, and a slider when the teacher allowed scrubbing.
 *
 * With `seek` off it is a `progressbar` and nothing else — not a disabled slider, which
 * would offer a control that is not there. The prototype was pointer-only; the arrow keys
 * here are the production half of that gap (plan 56 §3.12).
 */
function Track({
  eng,
  live,
  percent,
  band,
  label,
}: {
  eng: ExerciseAudioEngine;
  live: boolean;
  percent: number;
  band: { left: number; width: number } | null;
  label: string;
}) {
  const seekable = eng.audio.settings.seek && live;

  const shared = (
    <>
      {/* The fragment being played, marked on the track it belongs to. */}
      {band !== null && (
        <i
          className="absolute inset-y-0 block rounded-full"
          style={{
            left: `${band.left}%`,
            width: `${band.width}%`,
            background: 'var(--ssz-color-primary-200)',
          }}
        />
      )}
      <i
        className="absolute inset-y-0 left-0 block rounded-full"
        style={{ width: `${percent}%`, background: 'var(--ssz-color-primary-600)' }}
      />
    </>
  );

  const style = {
    height: seekable ? 8 : 6,
    background: 'var(--ssz-bg-muted)',
  } as const;

  if (!seekable) {
    return (
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.round(eng.duration)}
        aria-valuenow={Math.round(eng.state.pos)}
        className="relative w-full overflow-hidden rounded-full"
        style={style}
      >
        {shared}
      </div>
    );
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(eng.duration)}
      aria-valuenow={Math.round(eng.state.pos)}
      aria-valuetext={formatDuration(eng.state.pos)}
      onKeyDown={(event) => {
        const stepBy =
          event.key === 'ArrowRight' || event.key === 'ArrowUp'
            ? 5
            : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
              ? -5
              : null;
        if (stepBy !== null) {
          event.preventDefault();
          eng.seekTo(eng.state.pos + stepBy);
          return;
        }
        if (event.key === 'Home') {
          event.preventDefault();
          eng.seekTo(0);
        }
        if (event.key === 'End') {
          event.preventDefault();
          eng.seekTo(eng.duration);
        }
      }}
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        if (box.width === 0) return;
        eng.seekTo(((event.clientX - box.left) / box.width) * eng.duration);
      }}
      className="relative w-full cursor-pointer overflow-hidden rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
      style={style}
    >
      {shared}
    </div>
  );
}

/** Decoration, and decoration only: hidden from readers, still under reduced motion. */
function Bars({ playing }: { playing: boolean }) {
  return (
    <span aria-hidden="true" className="ml-auto flex items-end gap-0.5" style={{ height: 12 }}>
      {[0, 1, 2, 3].map((i) => (
        <i
          key={i}
          className={`block w-0.5 rounded-full ${playing ? 'motion-safe:animate-pulse' : ''}`}
          style={{
            height: playing ? [8, 12, 6, 10][i] : 4,
            background: 'var(--ssz-color-primary-400)',
            animationDelay: `${i * 90}ms`,
            transition: 'height 200ms',
          }}
        />
      ))}
    </span>
  );
}

/** One pip per listen the teacher allowed, spent ones greyed. */
function Plays({ spent, limit }: { spent: number; limit: number }) {
  const t = useTranslations('ExerciseRunner');
  const left = Math.max(0, limit - spent);

  return (
    <span className="ml-auto flex items-center gap-1.5">
      <span aria-hidden="true" className="flex gap-1">
        {Array.from({ length: limit }, (_, i) => (
          <i
            key={i}
            className="block rounded-full"
            style={{
              width: 6,
              height: 6,
              background:
                i < left ? 'var(--ssz-color-primary-600)' : 'var(--ssz-border-default)',
            }}
          />
        ))}
      </span>
      <span className="text-[11.5px] font-semibold text-(--ssz-text-muted)">
        {left === 0 ? t('audio.playsNone') : t('audio.playsLeft', { left, limit })}
      </span>
    </span>
  );
}

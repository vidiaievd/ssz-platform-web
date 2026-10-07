'use client';

import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ImageIcon, Loader2, MessageCircle, Pause, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useMediaAsset } from '@/features/media';
import { bucketPeaks } from '@/features/student/exercises/recorder';
import {
  formatSeconds,
  type Mode,
  type ProjectedCriterion,
  type ProjectedPrompt,
} from '@/lib/shared-kernel/read-aloud';

export const RA_FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)';
export const RA_READING = 'var(--ssz-font-reading)';
export const RA_MONO = 'var(--ssz-font-mono)';

/** `ra-rec-head`: 11px bold, widest tracking, caps, muted. */
export const RA_CAPS = 'text-[11px] font-bold uppercase tracking-(--ssz-tracking-widest)';

/** Where a take can be heard from: a `blob:` URL before upload, a signed URL after. */
export interface TakeSource {
  src: string | null;
  /** 0..1 — the adapter's envelope, then the server's peaks. Null draws a flat bar (§8 item 6). */
  peaks: readonly number[] | null;
}

/** `ra-meter`: 18 bars, 3px apart, 46px tall; a bar is `6 + v·38` px. */
export function Meter({ levels, tone }: { levels: readonly number[]; tone: 'calm' | 'live' }) {
  return (
    <div aria-hidden="true" className="flex items-end gap-[3px] px-0.5" style={{ height: 46 }}>
      {levels.map((v, i) => (
        <i
          key={i}
          className="block min-w-[3px] flex-1 rounded-[2px]"
          style={{
            height: Math.round(6 + Math.min(1, Math.max(0, v)) * 38),
            background:
              tone === 'live' ? 'var(--ssz-color-error-500)' : 'var(--ssz-color-primary-400)',
            transition: 'height 90ms linear',
          }}
        />
      ))}
    </div>
  );
}

/** `ra-rec-head`. */
export function RecHead({ children }: { children: ReactNode }) {
  return (
    <div className={`flex items-center gap-2 text-(--ssz-text-muted) ${RA_CAPS}`}>{children}</div>
  );
}

/** `ra-mono`, pushed to the right of a head. */
export function RecHeadAside({ children }: { children: ReactNode }) {
  return (
    <span
      className="ml-auto text-[10px] font-normal normal-case tracking-normal text-(--ssz-text-muted)"
      style={{ fontFamily: RA_MONO }}
    >
      {children}
    </span>
  );
}

/** `ra-clock`: mono 2xl bold, tabular, tight. */
export function Clock({ seconds, warn }: { seconds: number; warn?: boolean }) {
  return (
    <span
      className="text-2xl font-bold tabular-nums tracking-(--ssz-tracking-tight)"
      style={{
        fontFamily: RA_MONO,
        color: warn ? 'var(--ssz-color-warning-700)' : 'var(--ssz-text-primary)',
      }}
    >
      {formatSeconds(seconds)}
    </span>
  );
}

const WAVE_BARS_COMPACT = 34;

/**
 * One take, playable — the prototype's `TakePlayer`: a round play button, the waveform with the
 * part already heard in primary, the length. No scrubbing and no speed here: the student hears
 * their own voice back, the teacher's player is the one with both (plan 70 §4.2 item 12).
 *
 * The length is the take's own, not the element's: a WebM straight off `MediaRecorder` reports
 * an infinite duration until it has been played through, so progress is measured against it.
 */
export function TakePlayer({
  source,
  seconds,
  label,
  uploading = false,
  interactive = true,
}: {
  source: TakeSource;
  seconds: number;
  label: string;
  uploading?: boolean;
  interactive?: boolean;
}) {
  const t = useTranslations('ExerciseRunner.readAloud');
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);

  const bars =
    source.peaks === null || source.peaks.length === 0
      ? new Array<number>(WAVE_BARS_COMPACT).fill(0.18)
      : bucketPeaks(source.peaks, WAVE_BARS_COMPACT);
  const canPlay = interactive && source.src !== null;

  function toggle() {
    const el = audio.current;
    if (el === null) return;
    if (el.paused) void el.play().catch(() => setPlaying(false));
    else el.pause();
  }

  function track() {
    const el = audio.current;
    if (el === null) return;
    const total = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : seconds;
    setPos(total > 0 ? Math.min(1, el.currentTime / total) : 0);
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5">
      {source.src !== null && (
        <audio
          ref={audio}
          src={source.src}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setPos(0);
          }}
          onTimeUpdate={track}
        />
      )}
      <button
        type="button"
        onClick={(e) => {
          // A take row may be a button of its own (choosing it); playing is not choosing.
          e.stopPropagation();
          toggle();
        }}
        disabled={!canPlay}
        aria-label={playing ? t('take.pause') : t('take.play', { label })}
        aria-pressed={playing}
        className={`grid size-[34px] shrink-0 place-items-center rounded-full border disabled:opacity-50 ${RA_FOCUS}`}
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
        role="img"
        aria-label={`${label}, ${formatSeconds(seconds)}`}
        className="flex h-7 min-w-0 flex-1 items-center gap-0.5"
      >
        {bars.map((h, i) => (
          <i
            key={i}
            className="block min-w-[2px] flex-1 rounded-[1px]"
            style={{
              height: Math.max(2, Math.round(h * 26)),
              background:
                (i + 1) / bars.length <= pos && pos > 0
                  ? 'var(--ssz-color-primary-500)'
                  : 'var(--ssz-border-strong)',
            }}
          />
        ))}
      </div>
      <span
        className="inline-flex shrink-0 items-center gap-1 text-[11px] tabular-nums text-(--ssz-text-muted)"
        style={{ fontFamily: RA_MONO }}
      >
        {uploading && (
          <Loader2
            size={11}
            aria-label={t('take.uploading')}
            className="animate-spin motion-reduce:animate-none"
          />
        )}
        {formatSeconds(seconds)}
      </span>
    </div>
  );
}

/** `ra-take-n`: the take's number in a 24px circle, filled when chosen. */
export function TakeNumber({ n, selected }: { n: number; selected?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold"
      style={{
        fontFamily: RA_MONO,
        background: selected ? 'var(--ssz-color-primary-500)' : 'var(--ssz-bg-subtle)',
        color: selected ? '#fff' : 'var(--ssz-text-secondary)',
      }}
    >
      {n}
    </span>
  );
}

/** `ra-take`: a bordered row; chosen — primary border on primary-50. */
export function takeRowStyle(selected: boolean): CSSProperties {
  return {
    padding: '9px 11px',
    borderRadius: 'var(--ssz-radius-md)',
    border: `1px solid ${selected ? 'var(--ssz-color-primary-500)' : 'var(--ssz-border-default)'}`,
    background: selected ? 'var(--ssz-color-primary-50)' : 'var(--ssz-bg-surface)',
  };
}

/**
 * What the student looks at while the microphone is open — the only thing the mode decides
 * (README «What the type is for»): the passage, the picture and the plan, or the situation and
 * the partner's line. Content is in the course language and marked so.
 */
export function Material({
  mode,
  prompt,
  language,
}: {
  mode: Mode;
  prompt: ProjectedPrompt;
  language: string;
}) {
  const lang = language || undefined;
  if (mode === 'read') {
    return (
      <div
        className="rounded-(--ssz-radius-md) border"
        style={{
          padding: '12px 14px',
          background: 'var(--ssz-bg-base)',
          borderColor: 'var(--ssz-border-default)',
        }}
      >
        <p
          lang={lang}
          className="m-0 text-lg leading-(--ssz-leading-relaxed) text-(--ssz-text-primary)"
          style={{ fontFamily: RA_READING, textWrap: 'pretty' }}
        >
          {prompt.text}
        </p>
      </div>
    );
  }

  if (mode === 'monologue') {
    const plan = prompt.plan ?? [];
    return (
      <>
        <PromptImage image={prompt.image} />
        {plan.length > 0 && (
          <div lang={lang} className="flex flex-col gap-[5px]">
            {plan.map((point) => (
              <div
                key={point.id}
                className="flex items-start gap-2 text-sm text-(--ssz-text-secondary)"
              >
                <i
                  aria-hidden="true"
                  className="mt-[7px] block size-1.5 shrink-0 rounded-full"
                  style={{ background: 'var(--ssz-color-primary-400)' }}
                />
                <span>{point.text}</span>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  const turn = prompt.turn ?? { situation: '', partner: '' };
  return (
    <>
      {turn.situation.trim() !== '' && (
        <p lang={lang} className="m-0 text-xs text-(--ssz-text-muted)">
          {turn.situation}
        </p>
      )}
      <div
        className="flex items-start gap-[9px] rounded-(--ssz-radius-md) border"
        style={{
          padding: '10px 12px',
          background: 'var(--ssz-bg-subtle)',
          borderColor: 'var(--ssz-border-default)',
        }}
      >
        {/* The prototype's «SB» is content; an icon stands for the partner (§8 item 9). */}
        <span
          aria-hidden="true"
          className="grid size-[30px] shrink-0 place-items-center rounded-full"
          style={{
            background: 'var(--ssz-color-primary-100)',
            color: 'var(--ssz-color-primary-700)',
          }}
        >
          <MessageCircle size={14} />
        </span>
        <p
          lang={lang}
          className="m-0 text-base leading-(--ssz-leading-snug) text-(--ssz-text-primary)"
          style={{ fontFamily: RA_READING }}
        >
          {turn.partner}
        </p>
      </div>
    </>
  );
}

/** The picture of a monologue — or `ra-imgslot`, the hatched placeholder, while there is none. */
function PromptImage({ image }: { image: ProjectedPrompt['image'] }) {
  const t = useTranslations('ExerciseRunner.readAloud');
  const asset = useMediaAsset(image?.assetId === '' ? undefined : image?.assetId);
  const url = asset.data?.url;

  if (image !== undefined && url !== undefined) {
    return (
      <figure className="m-0 flex flex-col gap-1">
        {/* eslint-disable-next-line @next/next/no-img-element -- a signed media URL, not a static asset */}
        <img
          src={url}
          alt={image.alt}
          className="block max-h-[320px] w-full rounded-(--ssz-radius-md) object-contain"
          style={{ background: 'var(--ssz-bg-subtle)' }}
        />
        {image.caption.trim() !== '' && (
          <figcaption className="text-xs text-(--ssz-text-muted)">{image.caption}</figcaption>
        )}
      </figure>
    );
  }

  return (
    <div
      role="img"
      aria-label={image?.alt || t('imagePlaceholder')}
      className="grid place-items-center gap-1.5 rounded-(--ssz-radius-md) border border-dashed p-(--ssz-space-4) text-center text-[11px] text-(--ssz-text-muted)"
      style={{
        minHeight: 150,
        borderColor: 'var(--ssz-border-strong)',
        background:
          'repeating-linear-gradient(135deg, var(--ssz-bg-subtle) 0 9px, var(--ssz-bg-base) 9px 18px)',
        fontFamily: RA_MONO,
      }}
    >
      {asset.isLoading ? (
        <Loader2 size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
      ) : (
        <ImageIcon size={16} aria-hidden="true" />
      )}
    </div>
  );
}

/**
 * The rubric as a guide while recording — only under `showRubric: 'always'` (plan 70 §4.2
 * item 4): the visible criteria in `ra-critrow` rows, with no dots and no score, because there
 * is no mark yet. What each level means is under the name, best first.
 */
export function RubricGuide({ criteria }: { criteria: readonly ProjectedCriterion[] }) {
  const t = useTranslations('ExerciseRunner.readAloud');
  if (criteria.length === 0) return null;
  return (
    <section aria-label={t('rubricGuide')} className="flex flex-col">
      <RecHead>{t('rubricGuide')}</RecHead>
      {criteria.map((c) => (
        <div
          key={c.id}
          className="border-t py-2"
          style={{ borderColor: 'var(--ssz-border-default)' }}
        >
          <strong className="block text-sm text-(--ssz-text-primary)">{c.name}</strong>
          {(c.desc.trim() !== '' || c.levels[3].trim() !== '') && (
            <span
              className="mt-0.5 block text-xs text-(--ssz-text-secondary)"
              style={{ textWrap: 'pretty' }}
            >
              {c.levels[3].trim() !== '' ? c.levels[3] : c.desc}
            </span>
          )}
        </div>
      ))}
    </section>
  );
}

/**
 * `ra-steps`: three 4px bars — the recording (done), the AI stage (never live, so never lit —
 * DECISIONS §4) and the teacher (now, then done) — and where the work is.
 */
export function ReviewSteps({ graded }: { graded: boolean }) {
  const t = useTranslations('ExerciseRunner.readAloud');
  const bar = (s: 'done' | 'now' | null) => (
    <i
      className="block h-1 flex-1 rounded-full"
      style={{
        background:
          s === 'done'
            ? 'var(--ssz-color-success-500)'
            : s === 'now'
              ? 'var(--ssz-color-primary-500)'
              : 'var(--ssz-bg-muted)',
      }}
    />
  );
  return (
    <div className="flex items-center gap-1.5">
      {bar('done')}
      {bar(null)}
      {bar(graded ? 'done' : 'now')}
      <span className="text-[11px] text-(--ssz-text-muted)" style={{ fontFamily: RA_MONO }}>
        {graded ? t('steps.graded') : t('steps.atTeacher')}
      </span>
    </div>
  );
}

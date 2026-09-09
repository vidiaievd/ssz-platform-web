'use client';

import { ChevronDown, Headphones, Lock, Play, Square } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { formatDuration, type ExerciseAudio, type ItemAudio } from '@/lib/shared-kernel/audio';

import { ExerciseAudioPlayer } from './exercise-audio-player';
import type { ExerciseAudioEngine } from './use-exercise-audio';

/**
 * The listen-first screen — BEHAVIOR.md §4.
 *
 * `layout: 'gate'` fills the runner with this instead of the items. With
 * `gate: 'first'` the way through is locked until one complete listen; with `gate: 'none'`
 * it is a framing device and the button is live from the start. There is no way back to
 * it once entered: the compact player above the items carries the same controls.
 */
export function AudioGateScreen({
  eng,
  interactive = true,
  onStart,
}: {
  eng: ExerciseAudioEngine;
  interactive?: boolean;
  onStart: () => void;
}) {
  const t = useTranslations('ExerciseRunner');
  const locked = eng.gated;

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-8 text-center">
      <Headphones size={22} aria-hidden="true" style={{ color: 'var(--ssz-icon-muted)' }} />
      <div>
        <h3 className="m-0 text-[17px] font-bold text-(--ssz-text-primary)">
          {eng.audio.title.trim() === '' ? t('audio.gate.title') : eng.audio.title}
        </h3>
        <p className="mt-1 text-[13px] text-(--ssz-text-secondary)">
          {locked ? t('audio.gate.ledeLocked') : t('audio.gate.ledeOpen')}
        </p>
      </div>

      <div className="w-full" style={{ maxWidth: 420 }}>
        <ExerciseAudioPlayer eng={eng} tone="big" interactive={interactive} />
      </div>

      <button
        type="button"
        onClick={onStart}
        disabled={!interactive || locked}
        className="rounded-xl px-5 py-2.5 text-[14px] font-bold text-white disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
        style={{ background: 'var(--ssz-color-primary-600)' }}
      >
        {locked ? t('audio.gate.listenFirst') : t('audio.gate.toItems')}
      </button>
    </div>
  );
}

/** Why the items are not answering yet — BEHAVIOR.md §7. */
export function AudioLockNote({ itemNoun, own = false }: { itemNoun?: string; own?: boolean }) {
  const t = useTranslations('ExerciseRunner');

  return (
    <p
      role="status"
      className="mt-2 flex items-start gap-1.5 text-[12.5px]"
      style={{ color: 'var(--ssz-text-secondary)' }}
    >
      <Lock size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
      {/* `own` is the per-item source (plan 56 phase 6): the clip belongs to this one
          item, so the sentence is about it and not about "the clip" of the exercise. */}
      {itemNoun === undefined
        ? t('audio.lockNote')
        : own
          ? t('audio.lockNoteOwn', { item: itemNoun })
          : t('audio.lockNoteNamed', { items: itemNoun })}
    </p>
  );
}

/**
 * "Play the fragment 0:22–0:48" — BEHAVIOR.md §8.
 *
 * Free, always: a fragment spends no listen and completes no playthrough, so a student
 * who needs one line of a dialogue five times may have it. Disabled while the gate is
 * shut, because a fragment before the whole clip is the shortcut the gate exists to
 * prevent.
 */
export function AudioSegmentButton({
  eng,
  segment,
  disabled = false,
}: {
  eng: ExerciseAudioEngine;
  segment: ItemAudio | null;
  disabled?: boolean;
}) {
  const t = useTranslations('ExerciseRunner');
  if (segment === null) return null;

  const active =
    eng.state.range !== null &&
    eng.state.range.start === segment.start &&
    eng.state.range.end === segment.end;

  return (
    <button
      type="button"
      disabled={disabled || eng.failed}
      onClick={() =>
        active && eng.playing ? eng.toggle() : eng.playRange(segment.start, segment.end)
      }
      className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
      style={{
        borderColor: active ? 'var(--ssz-color-primary-500)' : 'var(--ssz-border-default)',
        background: active ? 'var(--ssz-color-primary-50)' : 'transparent',
        color: active ? 'var(--ssz-color-primary-700)' : 'var(--ssz-text-secondary)',
      }}
    >
      {active && eng.playing ? (
        <Square size={11} aria-hidden="true" />
      ) : (
        <Play size={11} aria-hidden="true" />
      )}
      {t('audio.fragment', {
        from: formatDuration(segment.start),
        to: formatDuration(segment.end),
      })}
    </button>
  );
}

/**
 * What the clip said — BEHAVIOR.md §9.
 *
 * Three policies, and this component sees only two of them, because the third is not a
 * matter of display: under `never` and before the reveal under `after` the words are not
 * in the browser at all (plan 56 §3.3). `always` is shown from the start and stays
 * readable behind a closed gate — it is the path for a student who cannot rely on hearing
 * the clip, and gating it would gate them out of the exercise.
 */
export function AudioTranscript({
  audio,
  revealed = false,
  /** The words the server owed and delivered with the key, when the policy is `after`. */
  delivered,
}: {
  audio: ExerciseAudio;
  revealed?: boolean;
  delivered?: { transcript: string; translation: string } | null;
}) {
  const t = useTranslations('ExerciseRunner');
  const [open, setOpen] = useState(false);

  const policy = audio.settings.transcriptWhen;
  const words = policy === 'always' ? audio : revealed ? delivered : null;

  if (!audio.enabled || policy === 'never') return null;
  if (!words || words.transcript.trim() === '') return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-(--ssz-text-secondary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
      >
        <ChevronDown
          size={13}
          aria-hidden="true"
          className="transition-transform"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        />
        {t('audio.transcript')}
      </button>

      {open && (
        <div
          className="mt-2 rounded-lg px-3.5 py-3 whitespace-pre-wrap"
          style={{
            background: 'var(--ssz-bg-subtle)',
            fontFamily: 'var(--ssz-font-reading)',
            fontSize: 14,
            lineHeight: 1.7,
            color: 'var(--ssz-text-secondary)',
          }}
        >
          {words.transcript}
          {words.translation.trim() !== '' && (
            <p
              className="mt-2 border-t pt-2 italic"
              style={{
                borderColor: 'var(--ssz-border-default)',
                borderTopStyle: 'dashed',
                color: 'var(--ssz-text-muted)',
              }}
            >
              {words.translation}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

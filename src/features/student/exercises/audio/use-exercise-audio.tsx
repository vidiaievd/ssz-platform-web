'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  audioOf,
  canPlay as canPlayNow,
  deliveredSegments,
  hasHeard,
  INITIAL_STATE,
  isExhausted,
  isGated,
  step,
  type AllowanceContext,
  type AllowanceEvent,
  type AllowanceState,
  type ExerciseAudio,
  type ItemAudio,
  type PlaybackEffect,
} from '@/lib/shared-kernel/audio';
import { useMediaAsset } from '@/features/media';

import { useLessonClip } from './use-lesson-clip';

/**
 * The browser's half of the playback engine — plan 56 §3.5.
 *
 * The rules live in the kernel (`allowance.ts`), without a DOM, because VoxOrd plays the
 * same clip through `react-native-sound` and polls for the position. This is the adapter:
 * it turns element events into kernel events, and applies the effect the kernel asks for
 * to an `HTMLAudioElement`. Every decision — whether a press spends a listen, whether a
 * fragment ends the playthrough, whether the gate opens — is made there, none of it here.
 *
 * **Not built on `useMediaPlayer`.** The plan proposed layering on it and said to stop if
 * the layering cost more than a couple of options; it does. That hook's whole shape is
 * position persistence across visits, and a restored position is the exact thing that
 * breaks "a listen is spent starting from the top" — the first press of the session would
 * be free. Its other features are a dozen lines here, and the two players stay honest
 * about being different instruments: one is for a lesson you may re-listen to forever,
 * the other for an exercise with an allowance.
 *
 * The shape — a pure transition, then an effect that applies its result to the element —
 * is what the compiler's rules ask for and what the kernel wanted anyway: nothing that
 * decides is allowed to touch the DOM, and nothing that touches the DOM decides.
 */
export interface ExerciseAudioEngine {
  audio: ExerciseAudio;
  /**
   * Every item's timecode, keyed by item id.
   *
   * Gathered onto the block by the projection rather than left on the items, because the
   * per-template projections do not carry a field that is not theirs (plan 56 §3.3). A
   * runner looks one up by the id of the item it is drawing.
   */
  segments: Record<string, ItemAudio>;
  /**
   * The `<audio>` element this engine drives. Render it anywhere inside the player.
   *
   * The element is created here rather than by the player because the ref that reaches
   * it must not leave this hook: an engine that handed one out would be an object with a
   * `.current` inside it, and every read of the engine during render would then be a ref
   * read. `null` when there is nothing to play.
   */
  element: React.ReactNode;
  /** The resolved playback URL, or null while it is being fetched or if there is none. */
  src: string | null;
  state: AllowanceState;
  /** Clip length: the element's own, falling back to the author's stored hint. */
  duration: number;
  playing: boolean;
  /** Listens spent and allowed. `limit === 0` is unlimited. */
  plays: number;
  limit: number;
  exhausted: boolean;
  heard: boolean;
  /** Items are locked: the teacher asked for one full listen and it has not happened. */
  gated: boolean;
  /** The press would do something. False when the next start would be refused. */
  canPlay: boolean;
  /** The clip could not be loaded or decoded. The gate opens when this is true. */
  failed: boolean;
  loading: boolean;
  speed: number;
  toggle: () => void;
  back: () => void;
  seekTo: (seconds: number) => void;
  playRange: (start: number, end: number) => void;
  cycleSpeed: () => void;
  reset: () => void;
}

/** 0.75 / 1 / 1.25 — the handoff's three, not the lesson player's four. */
const SPEEDS = [0.75, 1, 1.25] as const;

export interface UseExerciseAudioOptions {
  /** False pauses playback and refuses input: a hidden runner must not keep playing. */
  active?: boolean;
}

/**
 * The state, plus the instruction the element has not been given yet.
 *
 * `seq` is what makes an instruction happen exactly once: two presses of `−10 s` produce
 * the same effect twice, and an effect keyed on the object alone would apply the second
 * only if it happened to differ from the first.
 */
interface Playback {
  state: AllowanceState;
  effect: PlaybackEffect;
  seq: number;
}

const IDLE: Playback = {
  state: INITIAL_STATE,
  effect: { seekTo: null, transport: null },
  seq: 0,
};

export function useExerciseAudio(
  content: unknown,
  { active = true }: UseExerciseAudioOptions = {},
): ExerciseAudioEngine {
  const audio = useMemo(() => audioOf(content), [content]);
  const segments = useMemo(() => deliveredSegments(content), [content]);

  const node = useRef<HTMLAudioElement | null>(null);
  // Bumped when the element arrives, so the listener effect runs against it rather than
  // against the `null` of the first render.
  const [mounted, setMounted] = useState(0);
  const attach = useCallback((el: HTMLAudioElement | null) => {
    node.current = el;
    if (el !== null) setMounted((n) => n + 1);
  }, []);

  const [playback, setPlayback] = useState<Playback>(IDLE);
  const [elementDuration, setElementDuration] = useState(0);
  const [speed, setSpeed] = useState<number>(1);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  /*
    A `lesson` clip is a reference to a recording that lives in a lesson body, so the id
    comes back from there before media-service is asked anything (plan 56 §3.8). Resolved
    in the browser rather than in a projection, because two services project this block and
    only one of them has lessons — see `use-lesson-clip.ts`.
  */
  const lessonClip = useLessonClip(audio.source === 'lesson' ? audio.lessonRef : null);

  // A `link` clip is its own URL; an `asset` one is a storage key that media-service signs
  // for an hour, so it is resolved here rather than stored in the document. Asked for only
  // when there is an id to ask about — an exercise with no audio asks nothing.
  const assetId =
    audio.source === 'asset'
      ? audio.assetId
      : audio.source === 'lesson'
        ? (lessonClip ?? '')
        : '';
  const { data: asset, isError: assetFailed } = useMediaAsset(
    assetId === '' ? undefined : assetId,
  );
  const src =
    audio.source === 'link' ? (audio.url === '' ? null : audio.url) : (asset?.url ?? null);

  const duration = elementDuration > 0 ? elementDuration : audio.duration;
  const ctx: AllowanceContext = useMemo(
    () => ({ settings: audio.settings, duration }),
    [audio.settings, duration],
  );
  /**
   * One transition, applied to the playback state.
   *
   * It closes over the context rather than reading it from a ref, so it changes when the
   * clip length or the teacher's settings do. That is the honest dependency: a `seek`
   * clamped against last render's duration would clamp against zero for the first second
   * of every exercise.
   */
  const send = useCallback(
    (event: AllowanceEvent) => {
      setPlayback((current) => {
        const next = step(current.state, event, ctx);
        return { state: next.state, effect: next.effect, seq: current.seq + 1 };
      });
    },
    [ctx],
  );

  /*
    Two things reset playback, and both are adjustments to a change outside this hook
    rather than reactions to one — so they happen during render, which is where React asks
    for them to happen, and not in an effect.

    A new clip, a new layout or a new allowance is a new exercise as far as playback is
    concerned (INTEGRATION.md). And a runner that has gone away — a closed drawer, another
    tab — has to fall silent: never leave a voice coming out of a page nobody is looking at
    (BEHAVIOR §11).
  */
  const clip = `${audio.enabled}|${audio.assetId}|${audio.url}|${audio.settings.layout}|${audio.settings.plays}`;
  const [seen, setSeen] = useState({ clip, active });

  if (seen.clip !== clip) {
    setSeen({ clip, active });
    setPlayback((current) => ({ ...IDLE, seq: current.seq + 1 }));
    setElementDuration(0);
    setFailed(false);
  } else if (seen.active !== active) {
    setSeen({ clip, active });
    if (!active) {
      setPlayback((current) => {
        const next = step(current.state, { type: 'pause' }, ctx);
        return { state: next.state, effect: next.effect, seq: current.seq + 1 };
      });
    }
  }

  /* ── the kernel's instruction, carried out on the element ── */
  useEffect(() => {
    const el = node.current;
    if (!el) return;

    if (playback.effect.seekTo !== null) el.currentTime = playback.effect.seekTo;
    if (playback.effect.transport === 'play') {
      // A rejected promise is the browser refusing autoplay: the button goes back to idle
      // and the listen is not counted against a clip that never sounded (BEHAVIOR §11).
      void el.play().catch(() => send({ type: 'pause' }));
    }
    if (playback.effect.transport === 'pause') el.pause();
    // Applied once per transition, which is what `seq` counts.
  }, [playback.seq, playback.effect, send]);

  /* ── element events → kernel events ── */
  useEffect(() => {
    const el = node.current;
    if (!el) return;

    const onMeta = () => {
      setLoading(false);
      setElementDuration(Number.isFinite(el.duration) ? el.duration : 0);
    };
    const onTime = () => send({ type: 'time', pos: el.currentTime });
    const onEnded = () => send({ type: 'ended' });
    const onError = () => {
      setLoading(false);
      setFailed(true);
    };
    const onWaiting = () => setLoading(true);

    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('canplay', onMeta);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onError);
    el.addEventListener('loadstart', onWaiting);
    return () => {
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('canplay', onMeta);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onError);
      el.removeEventListener('loadstart', onWaiting);
    };
  }, [src, mounted, send]);

  useEffect(() => {
    if (node.current) node.current.playbackRate = speed;
  }, [speed, src, mounted]);

  const state = playback.state;
  const unplayable = failed || assetFailed === true || (src === null && audio.enabled);

  return {
    audio,
    segments,
    // `preload="none"`: an exercise page may hold several of these, and a clip nobody has
    // pressed play on has no business being fetched.
    element:
      src === null ? null : (
        <audio ref={attach} src={src} preload="none" className="sr-only" />
      ),
    src,
    state,
    duration,
    playing: state.playing,
    plays: state.plays,
    limit: audio.settings.plays,
    exhausted: isExhausted(state, audio.settings),
    heard: hasHeard(state),
    // A clip that cannot be played must never leave the exercise unanswerable, so the gate
    // opens on failure and the transcript opens with it (BEHAVIOR §11).
    gated: isGated(state, audio.settings, { playable: !unplayable }),
    canPlay: canPlayNow(state, ctx, { interactive: active && !unplayable }),
    failed: unplayable,
    loading,
    speed,
    toggle: () => {
      if (active) send({ type: state.playing ? 'pause' : 'play' });
    },
    back: () => send({ type: 'seek', to: state.pos - 10 }),
    seekTo: (seconds: number) => send({ type: 'seek', to: seconds }),
    playRange: (start: number, end: number) => send({ type: 'playRange', start, end }),
    cycleSpeed: () =>
      setSpeed((current) => SPEEDS[(SPEEDS.indexOf(current as 0.75) + 1) % SPEEDS.length] ?? 1),
    reset: () => send({ type: 'reset' }),
  };
}

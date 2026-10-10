'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

/**
 * The one-word clip player of `minimal_pairs` — plan 72, phase 6.1.
 *
 * The prototype's `useMPClips` ran a clock when it had no file, so it behaved the same with no
 * assets. Here there is always a file, and the clock is gone: a clip is over when the element
 * says it ended, not when its length has passed. What survives is the shape — play one, play a
 * few back to back with a pause between, stop, and «which one is sounding now» — and the rule
 * that one surface has one engine: starting a clip silences whatever was playing.
 *
 * The audio layer's player (scrubber, play budget, transcript) is not used, as the spec decides
 * (README «Deliberately not reused»): a probe is 700 ms with no inside to seek to. The listen
 * budget is not here either. It is the runner's, because only the runner knows which press is
 * the probe's own clip and which is a replay the budget does not cover (§4.2, point 8).
 *
 * A port, so that a test can stand in for the element — jsdom's `play()` plays nothing — and so
 * that the browser's refusal is an answer rather than an exception: `play()` resolves to
 * `'refused'` when autoplay policy blocks a clip, and the runner spends no listen on it (§4.2,
 * point 9).
 */

/** One clip to play. `id` is what `playing(id)` answers to: a word, or the probe itself. */
export interface Clip {
  id: string;
  url: string;
}

/** Whether a clip actually started. `'refused'` — the browser said no, or there was no file. */
export type PlayOutcome = 'played' | 'refused';

export interface ClipPlayer {
  /** Play one clip, silencing whatever was playing. Resolves once it has started or failed to. */
  play(clip: Clip): Promise<PlayOutcome>;
  /**
   * Play clips back to back, `SEQUENCE_GAP_MS` apart — the A/B comparison and «Hør paret».
   * Resolves with how the first one went; a later one that fails is skipped.
   */
  sequence(clips: Clip[]): Promise<PlayOutcome>;
  stop(): void;
  /** The id of the clip sounding now, or `null`. */
  current(): string | null;
  subscribe(listener: () => void): () => void;
}

/** The pause between two clips of a sequence — the prototype's 420 ms. */
export const SEQUENCE_GAP_MS = 420;

/**
 * How long past its own length a clip may go without an `ended` before it is called over. A
 * stalled download would otherwise leave the big button on «pause» for good.
 */
const STALL_GRACE_MS = 4000;
const DEFAULT_CLIP_MS = 2500;

type AudioFactory = (url: string) => HTMLAudioElement;

/** The player over `HTMLAudioElement`. One element per clip, made at the moment it plays. */
export function createBrowserClipPlayer(
  makeAudio: AudioFactory = (url) => new Audio(url),
): ClipPlayer {
  const listeners = new Set<() => void>();
  let now: string | null = null;
  /** Bumped by every play, sequence and stop: a callback from an older run is ignored. */
  let run = 0;
  let element: HTMLAudioElement | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const emit = () => listeners.forEach((l) => l());
  const set = (id: string | null) => {
    if (now === id) return;
    now = id;
    emit();
  };
  const halt = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (element !== null) {
      element.pause();
      element.removeAttribute('src');
      element = null;
    }
  };

  function start(list: Clip[]): Promise<PlayOutcome> {
    halt();
    const mine = ++run;
    const playable = list.filter((c) => c.url !== '');
    if (playable.length === 0) {
      set(null);
      return Promise.resolve('refused');
    }

    return new Promise<PlayOutcome>((resolve) => {
      let settled = false;
      const settle = (outcome: PlayOutcome) => {
        if (settled) return;
        settled = true;
        resolve(outcome);
      };

      const step = (i: number) => {
        if (mine !== run) return;
        const clip = playable[i];
        if (clip === undefined) {
          halt();
          set(null);
          return;
        }
        const el = makeAudio(clip.url);
        element = el;
        let over = false;
        /** This clip is over: on to the next of the sequence, or silence. */
        const done = () => {
          if (over || mine !== run) return;
          over = true;
          if (timer !== null) clearTimeout(timer);
          timer = null;
          if (i + 1 < playable.length) {
            set(null);
            timer = setTimeout(() => step(i + 1), SEQUENCE_GAP_MS);
          } else {
            element = null;
            set(null);
          }
        };
        /**
         * Refused by the browser or broken. The first clip failing ends the run — the second
         * half of an A/B with no first half is not a comparison; a later one is skipped.
         */
        const fail = () => {
          if (i > 0) {
            done();
            return;
          }
          settle('refused');
          if (over || mine !== run) return;
          over = true;
          halt();
          set(null);
        };
        el.addEventListener('ended', done);
        el.addEventListener('error', fail);
        set(clip.id);
        // Through a promise of its own: an older browser returns nothing from `play()`, and
        // one may throw at once rather than reject.
        Promise.resolve()
          .then(() => el.play())
          .then(() => {
            if (i === 0) settle('played');
            if (over || mine !== run) return;
            const ms =
              Number.isFinite(el.duration) && el.duration > 0
                ? el.duration * 1000
                : DEFAULT_CLIP_MS;
            timer = setTimeout(done, ms + STALL_GRACE_MS);
          }, fail);
      };
      step(0);
    });
  }

  return {
    play: (clip) => start([clip]),
    sequence: (clips) => start(clips),
    stop: () => {
      run++;
      halt();
      set(null);
    },
    current: () => now,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** What a test drives the player with — a clip ends when the test says so. */
export interface MockClipPlayer extends ClipPlayer {
  /** Every clip asked for, in order, as `play` and `sequence` received them. */
  readonly requests: Clip[][];
  /** The next `play`/`sequence` is refused, as autoplay policy would. */
  refuseNext(): void;
  /** The clip sounding now ends; the next of a sequence starts at once. */
  end(): void;
}

export function createMockClipPlayer(): MockClipPlayer {
  const listeners = new Set<() => void>();
  const requests: Clip[][] = [];
  let queue: Clip[] = [];
  let now: string | null = null;
  let refuse = false;
  const set = (id: string | null) => {
    now = id;
    listeners.forEach((l) => l());
  };
  const start = (list: Clip[]): Promise<PlayOutcome> => {
    requests.push(list);
    if (refuse || list.length === 0) {
      refuse = false;
      queue = [];
      set(null);
      return Promise.resolve('refused');
    }
    queue = list.slice(1);
    set(list[0]!.id);
    return Promise.resolve('played');
  };
  return {
    requests,
    refuseNext: () => {
      refuse = true;
    },
    end: () => {
      const next = queue.shift();
      set(next?.id ?? null);
    },
    play: (clip) => start([clip]),
    sequence: start,
    stop: () => {
      queue = [];
      set(null);
    },
    current: () => now,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The player as a surface reads it: what is sounding, and the three commands. */
export interface Clips {
  /** The id sounding now, or `null`. */
  now: string | null;
  playing: (id: string) => boolean;
  anyPlaying: boolean;
  play: (clip: Clip) => Promise<PlayOutcome>;
  sequence: (clips: Clip[]) => Promise<PlayOutcome>;
  stop: () => void;
}

const serverNow = () => null;

/**
 * One player per surface, for as long as it is mounted. Silenced on unmount — a clip that
 * outlives its screen is a clip nobody can stop. `player` is for tests and the builder preview;
 * left out, the browser's.
 */
export function useClipPlayer(player?: ClipPlayer): Clips {
  const [engine] = useState<ClipPlayer>(() => player ?? createBrowserClipPlayer());
  const now = useSyncExternalStore(engine.subscribe, engine.current, serverNow);

  // The cleanup only stops: under strict mode the effect runs twice on one engine, and an
  // engine torn down by the first cleanup would be dead for the second mount.
  useEffect(() => () => engine.stop(), [engine]);

  const play = useCallback((clip: Clip) => engine.play(clip), [engine]);
  const sequence = useCallback((clips: Clip[]) => engine.sequence(clips), [engine]);
  const stop = useCallback(() => engine.stop(), [engine]);

  return {
    now,
    playing: (id) => now === id,
    anyPlaying: now !== null,
    play,
    sequence,
    stop,
  };
}

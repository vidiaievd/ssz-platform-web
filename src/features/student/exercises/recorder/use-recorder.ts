'use client';

import { useEffect, useReducer, useRef, useState } from 'react';

import {
  initialState,
  reduce,
  takesOf,
  ticking,
  type Draft,
  type RecorderConfig,
  type RecorderEvent,
  type RecorderState,
} from '@/lib/shared-kernel/read-aloud';

import { flatLevels, type Capture, type RecorderPort } from './port';

/** How often the meter and the level check read the microphone — the prototype's 90 ms. */
export const LEVEL_MS = 90;

/** A take the hardware has just handed over, with where it belongs. */
export interface CapturedTake extends Capture {
  itemId: string;
  /** The take's number at its prompt, 1-based — the kernel's `Take.n`. */
  n: number;
  /** A `blob:` URL for listening back before (and after) the upload. */
  url: string;
}

export interface UseRecorderOptions {
  config: RecorderConfig;
  /** The microphone. `null` draws the recorder and never opens anything — a static preview. */
  port: RecorderPort | null;
  /** Called once per finished take, after the kernel has it. The runner uploads from here. */
  onCaptured?: (take: CapturedTake) => void;
  /**
   * Takes already uploaded on this attempt, back from its draft — applied once, when the
   * recorder is created (RA-R10). Later restores go through `restore`.
   */
  initialDraft?: Draft | null;
}

export interface RecorderHandle {
  state: RecorderState;
  /** What the meter shows now: live levels while listening, flat otherwise. */
  levels: number[];
  /** «Klar» — past the level check. */
  ready: () => void;
  /** «Start opptak» / «Ta opp på nytt». Opens the microphone first if it is not open. */
  begin: () => void;
  /** «Start nå» — skip what is left of the preparation. */
  startNow: () => void;
  /** «Stopp». */
  stop: () => void;
  choose: (index: number) => void;
  goto: (index: number) => void;
  /** «Prøv igjen» after a refusal or a missing device. */
  retryMic: () => void;
  /** Takes already uploaded, back from the attempt's draft. */
  restore: (draft: Draft) => void;
  reset: () => void;
  uploaded: (itemId: string, n: number, assetId: string) => void;
  uploadFailed: (itemId: string, n: number) => void;
  uploadRetry: (itemId: string, n: number) => void;
}

/**
 * The browser's half of the recorder — plan 70 §3.3, phase 6.1.
 *
 * The kernel's reducer decides everything: when the preparation ends, when a take stops, what
 * an interruption costs, which take is chosen. This hook only keeps time and touches hardware,
 * in the shape the audio layer already uses (plan 56): a pure transition in a reducer, and
 * effects that carry its result out to the port. Nothing that decides touches the microphone;
 * nothing that touches the microphone decides.
 *
 *   - **time** — one tick a second while a phase that counts is on, restarted per phase so a
 *     recording's first second is a whole one;
 *   - **the microphone** — opened on the level check, or on the first «Start» when there is
 *     none, *before* the preparation starts: a permission prompt answered while a clock runs
 *     would eat the student's preparation time;
 *   - **a take** — started when the kernel enters `rec`, stopped when it asks (`stopping`), the
 *     bytes answered back with `stopped`; the adapter's own clock gives the length;
 *   - **interruptions** — the port's, passed on; the kernel ignores them outside the phases
 *     that count and spends no take on them (§8 item 4).
 */
export function useRecorder({
  config,
  port,
  onCaptured,
  initialDraft = null,
}: UseRecorderOptions): RecorderHandle {
  const [state, dispatch] = useReducer(
    (s: RecorderState, e: RecorderEvent) => reduce(s, e, config),
    config,
    (c: RecorderConfig) =>
      initialDraft === null
        ? initialState(c)
        : reduce(
            initialState(c),
            { type: 'restore', takes: initialDraft.takes, chosen: initialDraft.chosen },
            c,
          ),
  );
  const [micOpen, setMicOpen] = useState(false);
  const [levels, setLevels] = useState<number[]>(flatLevels);

  /** Every `blob:` URL handed out, revoked when the recorder goes. */
  const urls = useRef<Set<string>>(new Set());
  const captured = useRef(onCaptured);
  useEffect(() => {
    captured.current = onCaptured;
  }, [onCaptured]);

  const { phase } = state;
  const prompt = config.prompts[state.index];
  const itemId = prompt?.id ?? null;
  const nextN = itemId === null ? 0 : takesOf(state, itemId).length + 1;

  // The level check opens the microphone as soon as it is on screen.
  useEffect(() => {
    if (port === null || phase !== 'mic' || micOpen) return;
    let live = true;
    void port.open().then((result) => {
      if (!live) return;
      if (result === 'ok') setMicOpen(true);
      else dispatch({ type: result });
    });
    return () => {
      live = false;
    };
  }, [port, phase, micOpen]);

  // One tick a second, from the start of each counting phase.
  const tickPhase = ticking(phase) ? phase : null;
  useEffect(() => {
    if (tickPhase === null) return;
    const id = setInterval(() => dispatch({ type: 'tick' }), 1000);
    return () => clearInterval(id);
  }, [tickPhase]);

  // The take starts when the kernel says the microphone is open for it.
  useEffect(() => {
    if (port === null || phase !== 'rec' || !micOpen) return;
    port.start();
  }, [port, phase, micOpen]);

  // …and ends when the kernel asks: the student's «Stopp», the prompt's maximum or 180 s.
  useEffect(() => {
    if (port === null || phase !== 'stopping' || itemId === null) return;
    let live = true;
    void port.stop().then((capture) => {
      if (!live) return;
      if (capture === null) {
        // Cancelled under the stop — an interruption got there first. Nothing to keep.
        dispatch({ type: 'interrupted' });
        return;
      }
      const url = URL.createObjectURL(capture.blob);
      urls.current.add(url);
      dispatch({
        type: 'stopped',
        ref: url,
        ...(Number.isFinite(capture.seconds) ? { seconds: capture.seconds } : {}),
      });
      captured.current?.({ ...capture, itemId, n: nextN, url });
    });
    return () => {
      live = false;
    };
  }, [port, phase, itemId, nextN]);

  // The meter, and the level check's ears.
  const listening = port !== null && micOpen && (phase === 'mic' || phase === 'rec');
  const checking = phase === 'mic';
  useEffect(() => {
    if (!listening || port === null) return;
    const id = setInterval(() => {
      const now = port.levels();
      setLevels(now);
      if (checking) dispatch({ type: 'level', value: Math.max(0, ...now), ms: LEVEL_MS });
    }, LEVEL_MS);
    return () => clearInterval(id);
  }, [listening, checking, port]);

  useEffect(() => {
    if (port === null) return;
    return port.onInterrupt((reason) => {
      if (reason !== 'hidden') setMicOpen(false);
      port.cancel();
      dispatch({ type: 'interrupted' });
    });
  }, [port]);

  useEffect(() => {
    const own = urls.current;
    return () => {
      port?.close();
      own.forEach((url) => URL.revokeObjectURL(url));
      own.clear();
    };
  }, [port]);

  function begin() {
    if (port === null) return;
    if (port.isOpen()) {
      dispatch({ type: 'begin' });
      return;
    }
    void port.open().then((result) => {
      if (result === 'ok') {
        setMicOpen(true);
        dispatch({ type: 'begin' });
      } else {
        dispatch({ type: result });
      }
    });
  }

  return {
    state,
    levels: listening ? levels : flatLevels(),
    ready: () => dispatch({ type: 'ready' }),
    begin,
    startNow: () => dispatch({ type: 'startNow' }),
    stop: () => dispatch({ type: 'stop' }),
    choose: (index) => dispatch({ type: 'choose', index }),
    goto: (index) => dispatch({ type: 'goto', index }),
    retryMic: () => dispatch({ type: 'retry' }),
    restore: (draft) => dispatch({ type: 'restore', takes: draft.takes, chosen: draft.chosen }),
    reset: () => dispatch({ type: 'reset' }),
    uploaded: (id, n, assetId) => dispatch({ type: 'uploaded', itemId: id, n, assetId }),
    uploadFailed: (id, n) => dispatch({ type: 'uploadFailed', itemId: id, n }),
    uploadRetry: (id, n) => dispatch({ type: 'uploadRetry', itemId: id, n }),
  };
}

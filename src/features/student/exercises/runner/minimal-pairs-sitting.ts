'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';

import type {
  MinimalPairsProbe,
  MinimalPairsProbeVerdict,
  MinimalPairsSubmitDetails,
} from '@/features/student/exercises/types/attempts';

import type { Clips } from './minimal-pairs-clips';

/**
 * One sitting of `minimal_pairs`, as the runner walks it — the prototype's `MPRunner` state with
 * the draw and the key moved to the server (plan 72 §3.6).
 *
 * The prototype drew the probes and judged the picks in the page. Here the page knows one probe
 * at a time, and only its clip and its buttons: `next` asks for the probe the sitting is on,
 * `answer` hands a button in and gets back right or wrong — the key only once the probe closes —
 * and `finish` sums the sitting up. Where those answers come from is a driver: the reader's
 * talks to the engine; the builder's preview will deal and judge with the kernel.
 *
 * **Sound is a consequence of an event, never of a render.** The prototype's own comment says
 * why an effect on the probe is wrong (`target` is a fresh object each render), and the React
 * Compiler forbids the setState it would need. So the probe's autoplay is scheduled by the
 * command that received the probe, the A/B comparison by the one that received the miss, and
 * the retry's replay by the one that received the second chance.
 *
 * **The listen budget is counted here, in the session** (plan 72 §5, row 17; plan 56 §3.6): a
 * press spends one only once the browser actually started the clip (§4.2, point 9), autoplay
 * spends the first like a press (point 8), and the replay of a second chance spends none.
 */

export interface SittingDriver {
  /** The probe the sitting is on, or `'closed'` when every probe is answered. */
  next(): Promise<MinimalPairsProbe | 'closed'>;
  answer(questionId: string, optionId: string): Promise<MinimalPairsProbeVerdict>;
  finish(): Promise<MinimalPairsSubmitDetails>;
}

/** Why a command failed, for the line the body shows. */
export type SittingFailure =
  /** The clip of the probe cannot be signed right now; nothing was recorded. */
  | 'media'
  /** The answer did not arrive; the probe is as it was. */
  | 'answer'
  /** The probe could not be fetched. */
  | 'probe'
  /** The result could not be fetched. */
  | 'finish';

export interface SittingState {
  phase: 'loading' | 'probe' | 'finishing' | 'done' | 'failed';
  probe: MinimalPairsProbe | null;
  /** The first answer of every probe closed so far, by probe number — the pips. */
  pips: Record<number, boolean>;
  /** Listens spent on the probe on screen. */
  plays: number;
  /** A wrong answer with a try left: «Ikke helt…», buttons open again. */
  retried: boolean;
  /** The verdict that closed the probe on screen; `null` while it is open. */
  verdict: MinimalPairsProbeVerdict | null;
  /** The button handed in last — the one the closing verdict judged. */
  picked: string | null;
  summary: MinimalPairsSubmitDetails | null;
  sending: boolean;
  failure: SittingFailure | null;
}

type Action =
  | { type: 'loading' }
  | { type: 'handed'; probe: MinimalPairsProbe }
  | { type: 'played' }
  | { type: 'sending'; optionId: string }
  | { type: 'retry' }
  | { type: 'closed'; verdict: MinimalPairsProbeVerdict }
  | { type: 'finishing' }
  | { type: 'finished'; summary: MinimalPairsSubmitDetails }
  | { type: 'failed'; failure: SittingFailure };

export const INITIAL_SITTING: SittingState = {
  phase: 'loading',
  probe: null,
  pips: {},
  plays: 0,
  retried: false,
  verdict: null,
  picked: null,
  summary: null,
  sending: false,
  failure: null,
};

export function sittingReducer(state: SittingState, action: Action): SittingState {
  switch (action.type) {
    case 'loading':
      return { ...state, phase: 'loading', failure: null };
    case 'handed': {
      const pips = { ...state.pips };
      for (const c of action.probe.closedProbes) pips[c.n] = c.correct;
      return {
        ...state,
        phase: 'probe',
        probe: action.probe,
        pips,
        plays: 0,
        // A reload on a second chance comes back with a try already spent.
        retried: action.probe.state.tries > 0,
        verdict: null,
        picked: null,
        sending: false,
        failure: null,
      };
    }
    case 'played':
      return { ...state, plays: state.plays + 1 };
    case 'sending':
      return { ...state, sending: true, picked: action.optionId, failure: null };
    case 'retry':
      return { ...state, sending: false, retried: true };
    case 'closed': {
      const n = state.probe?.n;
      return {
        ...state,
        sending: false,
        verdict: action.verdict,
        pips: n === undefined ? state.pips : { ...state.pips, [n]: action.verdict.firstCorrect },
      };
    }
    case 'finishing':
      return { ...state, phase: 'finishing', failure: null };
    case 'finished':
      return { ...state, phase: 'done', summary: action.summary, failure: null };
    case 'failed':
      return {
        ...state,
        sending: false,
        // A failed answer leaves the probe where it was; anything else has nothing to show.
        phase: action.failure === 'answer' ? state.phase : 'failed',
        failure: action.failure,
      };
  }
}

/** The pause before a probe plays by itself — the prototype's 420 ms. */
export const AUTOPLAY_DELAY_MS = 420;
/** The pause between a miss and its A/B comparison — the prototype's 320 ms. */
export const COMPARE_DELAY_MS = 320;

/** The id the probe's own clip plays under; never a word id — which word it is is the answer. */
export const PROBE_CLIP = 'probe';

export interface SittingOptions {
  driver: SittingDriver;
  clips: Clips;
  /** Listens per probe; `0` is unlimited. */
  playsPerProbe: number;
  autoplay: boolean;
  /** Fired once, with the result — the submit the evidence is written on. */
  onFinished?: (summary: MinimalPairsSubmitDetails) => void;
  /** Tells a failure the engine will keep making (`422`) from one worth another try. */
  isRefusal?: (error: unknown) => boolean;
  /** Tells an unsignable clip from any other failure to hand a probe out. */
  isMediaFailure?: (error: unknown) => boolean;
}

export interface Sitting {
  state: SittingState;
  /** Listens left on the probe on screen; `null` is unlimited. */
  left: number | null;
  /** Ask for the probe the sitting is on — the start, and «Prøv igjen» after a failure. */
  begin: () => void;
  /** The big button: the probe's clip, or a pause while it sounds. */
  playProbe: () => void;
  pick: (optionId: string) => void;
  /** «Neste» / «Se resultatet». */
  next: () => void;
  /** Play the A/B comparison again — «Hør «A» og «B»». */
  replayCompare: () => void;
  /** Play one word of the comparison. */
  playWord: (id: string, url: string) => void;
  /** The result could not be fetched: ask again. */
  retryFinish: () => void;
}

export function useMinimalPairsSitting({
  driver,
  clips,
  playsPerProbe,
  autoplay,
  onFinished,
  isRefusal = () => false,
  isMediaFailure = () => false,
}: SittingOptions): Sitting {
  const [state, dispatch] = useReducer(sittingReducer, INITIAL_SITTING);

  // The latest values, for timers and promise callbacks that outlive the render that set them.
  const latest = useRef({ state, driver, clips, onFinished });
  useEffect(() => {
    latest.current = { state, driver, clips, onFinished };
  });

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const reported = useRef(false);
  const finishing = useRef(false);
  /**
   * An answer is on its way. A ref, not state: two taps inside one frame would both read a
   * `sending` that has not rendered yet, and the second answer would land on the next probe.
   */
  const answering = useRef(false);

  /** Play the probe's clip as a listen: spent only once it actually started. */
  const listen = useCallback((url: string) => {
    void latest.current.clips.play({ id: PROBE_CLIP, url }).then((outcome) => {
      if (outcome === 'played') dispatch({ type: 'played' });
    });
  }, []);

  const finish = useCallback(() => {
    if (finishing.current) return;
    finishing.current = true;
    clearTimer();
    latest.current.clips.stop();
    dispatch({ type: 'finishing' });
    latest.current.driver.finish().then(
      (summary) => {
        dispatch({ type: 'finished', summary });
        if (!reported.current) {
          reported.current = true;
          latest.current.onFinished?.(summary);
        }
      },
      () => {
        finishing.current = false;
        dispatch({ type: 'failed', failure: 'finish' });
      },
    );
  }, []);

  const handOut = useCallback(() => {
    clearTimer();
    dispatch({ type: 'loading' });
    latest.current.driver.next().then(
      (probe) => {
        if (probe === 'closed') {
          finish();
          return;
        }
        dispatch({ type: 'handed', probe });
        // Autoplay spends the first listen, as a press would (§4.2, point 8) — but not on a
        // probe already answered once: the second chance is listened to on request.
        if (autoplay && probe.state.tries === 0) {
          timer.current = setTimeout(() => listen(probe.clip.url), AUTOPLAY_DELAY_MS);
        }
      },
      (e: unknown) => dispatch({ type: 'failed', failure: isMediaFailure(e) ? 'media' : 'probe' }),
    );
  }, [autoplay, finish, isMediaFailure, listen]);

  const left = playsPerProbe > 0 ? Math.max(0, playsPerProbe - state.plays) : null;

  const playProbe = useCallback(() => {
    const { state: now, clips: player } = latest.current;
    if (now.probe === null) return;
    clearTimer();
    // While it sounds the button is a pause, budget or none (§4.2, point 12).
    if (player.playing(PROBE_CLIP)) {
      player.stop();
      return;
    }
    if (playsPerProbe > 0 && now.plays >= playsPerProbe) return;
    listen(now.probe.clip.url);
  }, [listen, playsPerProbe]);

  const pick = useCallback(
    (optionId: string) => {
      const { state: now } = latest.current;
      if (now.probe === null || answering.current || now.verdict !== null) return;
      const probe = now.probe;
      answering.current = true;
      clearTimer();
      dispatch({ type: 'sending', optionId });
      latest.current.driver.answer(probe.questionId, optionId).then(
        (verdict) => {
          answering.current = false;
          if (!verdict.closed) {
            dispatch({ type: 'retry' });
            // The clip again, free of the budget: the point of a second chance is to listen.
            void latest.current.clips.play({ id: PROBE_CLIP, url: probe.clip.url });
            return;
          }
          latest.current.clips.stop();
          dispatch({ type: 'closed', verdict });
          const compare = verdict.compare;
          if (!verdict.correct && compare !== undefined) {
            timer.current = setTimeout(() => {
              void latest.current.clips.sequence([
                { id: verdict.optionId, url: compare.chosen },
                { id: verdict.keyOptionId ?? 'target', url: compare.target },
              ]);
            }, COMPARE_DELAY_MS);
          }
        },
        (e: unknown) => {
          answering.current = false;
          // Refused: the probe is closed or not the current one — the server knows which, so
          // ask it for where the sitting stands rather than guess.
          if (isRefusal(e)) {
            handOut();
            return;
          }
          dispatch({ type: 'failed', failure: 'answer' });
        },
      );
    },
    [handOut, isRefusal],
  );

  const next = useCallback(() => {
    const { state: now } = latest.current;
    if (now.probe === null || now.verdict === null) return;
    latest.current.clips.stop();
    if (now.probe.n >= now.probe.total) finish();
    else handOut();
  }, [finish, handOut]);

  const replayCompare = useCallback(() => {
    const { state: now } = latest.current;
    const v = now.verdict;
    if (v === null || v.compare === undefined) return;
    clearTimer();
    void latest.current.clips.sequence([
      { id: v.optionId, url: v.compare.chosen },
      { id: v.keyOptionId ?? 'target', url: v.compare.target },
    ]);
  }, []);

  const playWord = useCallback((id: string, url: string) => {
    clearTimer();
    const player = latest.current.clips;
    if (player.playing(id)) player.stop();
    else void player.play({ id, url });
  }, []);

  return {
    state,
    left,
    begin: handOut,
    playProbe,
    pick,
    next,
    replayCompare,
    playWord,
    retryFinish: finish,
  };
}

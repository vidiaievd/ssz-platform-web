'use client';

import { useCallback, useRef, useState } from 'react';
import { useLocale } from 'next-intl';

import type { Capture } from '@/features/student/exercises/recorder';
import { uploadRecording } from '@/features/media/lib/upload';

import { soundSessionApi, type Refusal, type SoundSessionApi } from './session-api';
import type {
  ReferenceClip,
  SessionBudget,
  SessionResult,
  SoundInstruction,
  SoundSession,
  TakeResult,
} from './types';

/**
 * Where the learner is in a session. The engine holds the truth (the step, the takes, the
 * ratings); this only walks its answers: start → look at the step → say it → see the verdict →
 * next step … → hand in.
 *
 *  idle        nothing begun
 *  starting    asking for a session
 *  refused     the door said no (`refusal.code`: SESSION_LIMIT, POOL_EMPTY, NOT_AVAILABLE, …)
 *  step        a step to say, with its clips and the base's instruction
 *  sending     a take is on its way and being heard
 *  verdict     the last take's answer is on screen; `next()` moves on
 *  ending      the session is over (done, or stopped by the payer); `finish()` hands it in
 *  submitting  the hand-in is on its way
 *  result      handed in; the ratings are in `result`
 *  broken      something is not right; `reload()` asks the engine where we are
 */
export type SoundSessionPhase =
  | 'idle'
  | 'starting'
  | 'refused'
  | 'step'
  | 'sending'
  | 'verdict'
  | 'ending'
  | 'submitting'
  | 'result'
  | 'broken';

/** Why a take was not heard, as the screen says it. */
export type TakeNotice = 'uploadFailed' | 'notReady' | 'inaudible' | 'tryAgain' | 'stale';

export interface SoundSessionState {
  phase: SoundSessionPhase;
  session: SoundSession | null;
  budget: SessionBudget | null;
  clips: ReferenceClip[];
  instruction: SoundInstruction | null;
  /** The take the verdict screen is about. */
  take: TakeResult | null;
  /** A take that did not count; the same step is still in front of the learner. */
  notice: TakeNotice | null;
  refusal: Refusal | null;
  result: SessionResult | null;
}

const INITIAL: SoundSessionState = {
  phase: 'idle',
  session: null,
  budget: null,
  clips: [],
  instruction: null,
  take: null,
  notice: null,
  refusal: null,
  result: null,
};

function extensionOf(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}

const NOTICE_OF: Record<string, TakeNotice> = {
  recording_not_ready: 'notReady',
  recording_inaudible: 'inaudible',
};

export interface UseSoundSessionOptions {
  language: string;
  api?: SoundSessionApi;
  /** Uploads a take as a recording of the attempt; returns its asset id. */
  upload?: (input: { capture: Capture; attemptId: string; filename: string }) => Promise<{ assetId: string }>;
}

export function useSoundSession({ language, api = soundSessionApi, upload }: UseSoundSessionOptions) {
  const locale = useLocale();
  const [state, setState] = useState<SoundSessionState>(INITIAL);
  const busy = useRef(false);

  const patch = useCallback((p: Partial<SoundSessionState>) => setState((s) => ({ ...s, ...p })), []);

  /** Fetch the step's clips and instruction; the session in hand is already known. */
  const showStep = useCallback(
    async (attemptId: string, extra: Partial<SoundSessionState> = {}) => {
      const items = await api.items(attemptId, locale);
      if (!items.ok) {
        patch({ phase: 'broken', refusal: items.refusal, ...extra });
        return;
      }
      const { session, clips, instruction } = items.data;
      patch({
        session,
        clips,
        instruction,
        phase: session.phase === 'done' ? 'ending' : 'step',
        ...extra,
      });
    },
    [api, locale, patch],
  );

  /** Begin a session (or pick up the open one); `atomId` — the learner chose a sound. */
  const start = useCallback(
    async (atomId?: string) => {
      if (busy.current) return;
      busy.current = true;
      setState({ ...INITIAL, phase: 'starting' });
      try {
        const res = await api.start(language, atomId);
        if (!res.ok) {
          patch({ phase: 'refused', refusal: res.refusal });
          return;
        }
        const { session, budget } = res.data;
        patch({ session, budget });
        if (session.phase === 'done') {
          patch({ phase: 'ending' });
          return;
        }
        await showStep(session.attemptId, { budget });
      } finally {
        busy.current = false;
      }
    },
    [api, language, patch, showStep],
  );

  /** Say the step: upload the take, have it heard, show the verdict. */
  const sendTake = useCallback(
    async (capture: Capture) => {
      const session = state.session;
      if (busy.current || session === null || state.phase !== 'step') return;
      busy.current = true;
      patch({ phase: 'sending', notice: null });
      try {
        let assetId: string;
        try {
          const doUpload =
            upload ??
            ((input) =>
              uploadRecording({
                blob: input.capture.blob,
                mimeType: input.capture.mimeType,
                attemptId: input.attemptId,
                filename: input.filename,
              }));
          ({ assetId } = await doUpload({
            capture,
            attemptId: session.attemptId,
            filename: `take-${session.takeIndex}.${extensionOf(capture.mimeType)}`,
          }));
        } catch {
          patch({ phase: 'step', notice: 'uploadFailed' });
          return;
        }

        const res = await api.take(session.attemptId, {
          recordingAssetId: assetId,
          takeIndex: session.takeIndex,
          explanationLanguage: locale,
        });
        // The take is a try, not a work: the engine deletes it once heard; a failed delete costs only storage.
        void fetch(`/api/media/assets/${assetId}`, { method: 'DELETE' }).catch(() => undefined);

        if (!res.ok) {
          const { status, code } = res.refusal;
          if (status === 409 && code === 'STALE_TAKE') {
            // Another tab (or a double send) moved the session: look again, say nothing is lost.
            await showStep(session.attemptId, { notice: 'stale' });
          } else if (status === 409 || status === 404) {
            patch({ phase: 'broken', refusal: res.refusal });
          } else {
            patch({ phase: 'step', notice: 'tryAgain', refusal: res.refusal });
          }
          return;
        }

        const take = res.data;
        if (take.outcome === 'retry') {
          patch({
            session: take.session,
            phase: 'step',
            notice: NOTICE_OF[take.reason ?? ''] ?? 'tryAgain',
          });
          return;
        }
        patch({
          session: take.session,
          take,
          phase: 'verdict',
          // `stopped`: the payer cannot go on; what was measured is handed in from the verdict screen.
        });
      } finally {
        busy.current = false;
      }
    },
    [api, locale, patch, showStep, state.phase, state.session, upload],
  );

  /** From the verdict to the next step, or to the end. */
  const next = useCallback(async () => {
    const session = state.session;
    if (busy.current || session === null || state.phase !== 'verdict') return;
    if (session.phase === 'done' || state.take?.outcome === 'stopped') {
      patch({ phase: 'ending', take: null });
      return;
    }
    busy.current = true;
    try {
      await showStep(session.attemptId, { take: null });
    } finally {
      busy.current = false;
    }
  }, [patch, showStep, state.phase, state.session, state.take]);

  /** Hand the session in: the ratings reach the learner's cards. */
  const finish = useCallback(async () => {
    const session = state.session;
    if (busy.current || session === null || state.phase !== 'ending') return;
    busy.current = true;
    patch({ phase: 'submitting' });
    try {
      const res = await api.submit(session.attemptId, locale);
      if (!res.ok) {
        // 409: already handed in elsewhere — nothing more to do for this session.
        patch({ phase: 'ending', refusal: res.refusal });
        return;
      }
      patch({ phase: 'result', result: res.data, refusal: null });
    } finally {
      busy.current = false;
    }
  }, [api, locale, patch, state.phase, state.session]);

  /** After a fault: ask the engine where the session stands. */
  const reload = useCallback(async () => {
    const session = state.session;
    if (busy.current || session === null) return;
    busy.current = true;
    try {
      await showStep(session.attemptId, { refusal: null });
    } finally {
      busy.current = false;
    }
  }, [showStep, state.session]);

  const reset = useCallback(() => setState(INITIAL), []);

  return { ...state, start, sendTake, next, finish, reload, reset };
}
